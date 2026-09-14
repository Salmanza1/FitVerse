/**
 * Meal scanner — one photo (plus whatever the eater tells us) in, an itemised
 * nutrition estimate out.
 *
 * What the published benchmarks say moves accuracy, and how each is used here:
 *
 * - Model choice dominates everything else (Vedovelli et al., Sci Rep 2026),
 *   so this runs on the strongest vision tier the proxy allows rather than
 *   the chat model.
 * - Non-visual context is the biggest lever after that. Image-only kcal error
 *   is ~30% MAPE; naming cooking fat, dairy fat, sweetener and meat type
 *   brings it to ~24%, and full ingredients to ~14% (PMC12655113, GPT-5).
 *   Hence the free-text notes and the follow-up questions the model asks.
 * - Meal type, time of day and venue each shave error on their own
 *   (arXiv 2507.07048), so they ride along as metadata — and on campus the
 *   dining hall's live menu is passed as candidates, which grounds the
 *   guess in the actual per-serving nutrition of what is being served.
 * - Fat is the worst-estimated macro (hidden oil, dressing, cheese) and
 *   bowls are the worst-estimated shape (no depth cue). The prompt calls
 *   both out explicitly.
 * - Portion size is the dominant residual error, and human correction is
 *   the accepted fix, so the result is itemised with per-item portion
 *   scaling in the UI rather than one opaque total.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { callProxy } from '@/lib/openai';
import { FoodItem, MealType } from '@/types/nutrition';

/**
 * Vision tier. `gpt-5.6-sol` is OpenAI's strongest at detection and
 * counting; `gpt-5.6-terra` is ~40% cheaper and a little quicker at a small
 * accuracy cost. Both must stay in the proxy's allowlist.
 */
export const MEAL_SCAN_MODEL = 'gpt-5.6-sol';
const REASONING_EFFORT = 'medium';
/** Shared between hidden reasoning and the visible JSON. */
const MAX_COMPLETION_TOKENS = 6000;

/**
 * Long edge of the photo sent up. The model works at roughly this
 * resolution anyway, and a 12 MP camera JPEG would be several MB of base64
 * through the edge function for no gain.
 */
const MAX_IMAGE_EDGE = 1280;
const JPEG_QUALITY = 0.8;

/** Menu candidates passed to the model, mains first. */
const MAX_MENU_CANDIDATES = 90;

export type ScanConfidence = 'high' | 'medium' | 'low';

export interface ScannedItem {
    id: string;
    name: string;
    /** Human-readable portion, e.g. "1 breast (~140 g)". */
    portion: string;
    grams: number;
    /** All four are for the estimated portion, before any user scaling. */
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence: ScanConfidence;
    /** The assumption that most affects this item, or ''. */
    note: string;
    /** True when tied to a dish on today's dining hall menu. */
    menuMatch: boolean;
    /** True when the numbers were read off a Nutrition Facts panel. */
    fromLabel: boolean;
}

export interface MealScanResult {
    mealName: string;
    items: ScannedItem[];
    calorieRange: { low: number; high: number };
    confidence: ScanConfidence;
    assumptions: string[];
    /** Up to two questions whose answers would most change the numbers. */
    questions: string[];
}

export interface MealScanVenue {
    /** e.g. "North Dining Hall". */
    name: string;
    /** Today's menu at that venue; filtered to the meal by the service. */
    menu: FoodItem[];
}

export interface MealScanInput {
    /** JPEG, no data-URL prefix. From `prepareMealPhoto`. */
    base64Jpeg: string;
    meal: MealType;
    /** Free text from the eater. Authoritative over the image. */
    context?: string;
    venue?: MealScanVenue | null;
    /** When the photo was taken; defaults to now. */
    at?: Date;
}

export class NotFoodError extends Error {
    constructor() {
        super('No food or drink was found in this photo.');
        this.name = 'NotFoodError';
    }
}

export interface PreparedPhoto {
    uri: string;
    base64: string;
    width: number;
    height: number;
}

/**
 * Downscale and re-encode a camera or library image for upload.
 *
 * Never upscales; a small image is just re-encoded so the payload is always
 * JPEG regardless of what the picker handed back (HEIC on iOS, PNG from a
 * screenshot).
 */
export async function prepareMealPhoto(
    uri: string,
    size?: { width: number; height: number }
): Promise<PreparedPhoto> {
    const ctx = ImageManipulator.manipulate(uri);
    if (size && Math.max(size.width, size.height) > MAX_IMAGE_EDGE) {
        ctx.resize(size.width >= size.height ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE });
    }
    const rendered = await ctx.renderAsync();
    try {
        const saved = await rendered.saveAsync({
            compress: JPEG_QUALITY,
            format: SaveFormat.JPEG,
            base64: true,
        });
        if (!saved.base64) throw new Error('Could not encode the photo.');
        return { uri: saved.uri, base64: saved.base64, width: saved.width, height: saved.height };
    } finally {
        rendered.release();
    }
}

const SYSTEM_PROMPT = `You are a registered dietitian and a technical food-image analyst. You estimate the nutrition of one meal from a photograph plus any notes from the person eating it. Be literal and calibrated: describe only what the image and notes support, state every assumption, and never add hidden ingredients that are not typical of the dish.

Work through the meal in this order.

1. Identify every distinct food and drink. Count discrete pieces (slices, nuggets, eggs). Ignore utensils and background clutter. Read packaging rather than ignoring it — a product name or a Nutrition Facts panel is evidence, and the label rules below take over when one is legible.

2. Estimate the edible portion of each item in grams. Anchor to visible references: a dinner plate is about 26-27 cm across, a side plate about 20 cm, a standard fork about 18 cm, a cafeteria tray about 35 x 45 cm, a mug about 300 ml, a cereal or rice bowl about 400-500 ml when full. Judge depth and heaping: bowls and piles are the most under-estimated shapes. Any quantity stated in the notes is authoritative.

3. Convert grams to nutrition using USDA-style values for the food AS SERVED (cooked, not raw). Account for fat that is easy to miss: cooking oil or butter (typically 1-2 teaspoons per sauteed or grilled portion), dressings, sauces, cheese, mayo, and whole-fat dairy. Restaurant and dining-hall cooking uses more fat than home cooking unless the notes say otherwise.

4. Sanity check every item: calories should be within about 10% of 4 x protein + 4 x carbs + 9 x fat. Fix any item that fails.

5. Give a calorie range for the whole meal that honestly reflects the uncertainty from portion size and hidden fat, and rate your overall confidence.

6. Ask at most two short questions whose answers would most change the numbers — cooking fat, dressing or sauce, meat cut, dairy fat, piece count. Never ask about something the notes already answer. Ask nothing if the estimate is already high-confidence.

NUTRITION LABELS AND PACKAGING

A readable Nutrition Facts panel is the most accurate input there is. When the photo shows one, read it rather than estimating, and mark those items as coming from a label.

- Take the serving size, servings per container, calories, protein, carbohydrate and fat straight off the panel. Never re-estimate a number the label states, even if it looks unusual.
- Use the product name from the packaging as the item name when it is legible (e.g. "Soy & scallion noodle bowl"); otherwise describe the food plainly.
- Then work out how much was actually eaten, which the panel does not tell you. Unless the notes say otherwise, assume a single-serve container — a noodle cup, a yoghurt pot, a canned drink, a snack bar, a ready meal for one — was finished, so multiply the per-serving figures by the servings per container. If the container plainly holds several servings and the notes do not say how much was eaten, assume one serving and record that in the assumptions.
- Set an item's confidence to high when its numbers come from a label. If part of the panel is cut off or unreadable, estimate only the missing figures and say which ones in the assumptions.
- A label and food may both be in shot. Do not double count: log the food once, using the label's numbers.

When a list of dishes served at the venue today is provided, match an item to a listed dish whenever the photo plausibly shows it, use that dish's per-serving nutrition scaled to the portion you see, and mark the item as a menu match. Do not force a match onto food that is clearly something else. A label always beats a menu match.

Keep item names short and plain (e.g. "Grilled chicken breast", "Brown rice", "Caesar dressing"). The meal name is at most five words.

Set is_food to false only when there is nothing loggable in the photo at all — no food, no drink, and no nutrition panel or packaging you can read.`;

const RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['is_food', 'meal_name', 'items', 'calorie_range', 'confidence', 'assumptions', 'questions'],
    properties: {
        is_food: { type: 'boolean' },
        meal_name: { type: 'string' },
        items: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: [
                    'name',
                    'portion',
                    'grams',
                    'calories',
                    'protein_g',
                    'carbs_g',
                    'fat_g',
                    'confidence',
                    'note',
                    'menu_match',
                    'from_label',
                ],
                properties: {
                    name: { type: 'string' },
                    portion: { type: 'string', description: 'Human-readable portion, e.g. "1 breast (~140 g)"' },
                    grams: { type: 'number' },
                    calories: { type: 'number' },
                    protein_g: { type: 'number' },
                    carbs_g: { type: 'number' },
                    fat_g: { type: 'number' },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    note: { type: 'string', description: 'The one assumption that most affects this item, or empty' },
                    menu_match: { type: 'boolean' },
                    from_label: {
                        type: 'boolean',
                        description: 'Figures read off a Nutrition Facts panel rather than estimated',
                    },
                },
            },
        },
        calorie_range: {
            type: 'object',
            additionalProperties: false,
            required: ['low', 'high'],
            properties: { low: { type: 'number' }, high: { type: 'number' } },
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        assumptions: { type: 'array', items: { type: 'string' } },
        questions: { type: 'array', items: { type: 'string' } },
    },
} as const;

function formatWhen(at: Date): string {
    return at.toLocaleString('en-US', {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/** Dishes on today's menu that are served at this meal, mains first. */
function menuCandidates(menu: FoodItem[], meal: MealType): FoodItem[] {
    const servedNow = menu.filter((m) => !m.mealTypes || m.mealTypes.length === 0 || m.mealTypes.includes(meal));
    const pool = servedNow.length > 0 ? servedNow : menu;
    return [...pool]
        .sort((a, b) => Number(!!b.isMainItem) - Number(!!a.isMainItem))
        .slice(0, MAX_MENU_CANDIDATES);
}

function buildUserText(input: MealScanInput): string {
    const at = input.at ?? new Date();
    const lines: string[] = [`Meal: ${input.meal}, ${formatWhen(at)}.`];

    if (input.venue) {
        lines.push(`Eating at: ${input.venue.name}.`);
    }

    const notes = input.context?.trim();
    lines.push(notes ? `Notes from the eater: "${notes}"` : 'Notes from the eater: none.');

    if (input.venue) {
        const candidates = menuCandidates(input.venue.menu, input.meal);
        if (candidates.length > 0) {
            lines.push('');
            lines.push(
                `Served today at ${input.venue.name} for ${input.meal} (name; kcal; protein/carbs/fat in g; per serving):`
            );
            for (const c of candidates) {
                const serving = c.servingSize ? ` per ${c.servingSize}` : '';
                lines.push(
                    `- ${c.name}; ${Math.round(c.calories)} kcal; ${Math.round(c.protein)}/${Math.round(c.carbs)}/${Math.round(c.fat)}${serving}`
                );
            }
        }
    }

    lines.push('');
    lines.push('Analyze the photo and return the JSON.');
    return lines.join('\n');
}

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
};

const confidenceOf = (v: unknown): ScanConfidence => (v === 'high' || v === 'low' ? v : 'medium');

/** Sum of the items' calories, before user scaling. */
export function scanTotals(items: ScannedItem[], scale: Record<string, number> = {}) {
    return items.reduce(
        (acc, item) => {
            const k = scale[item.id] ?? 1;
            acc.calories += item.calories * k;
            acc.protein += item.protein * k;
            acc.carbs += item.carbs * k;
            acc.fat += item.fat * k;
            return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

export async function scanMeal(input: MealScanInput): Promise<MealScanResult> {
    const response = await callProxy({
        model: MEAL_SCAN_MODEL,
        reasoning_effort: REASONING_EFFORT,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    { type: 'text', text: buildUserText(input) },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${input.base64Jpeg}`,
                            detail: 'high',
                        },
                    },
                ],
            },
        ],
        response_format: {
            type: 'json_schema',
            json_schema: { name: 'meal_scan', strict: true, schema: RESPONSE_SCHEMA },
        },
    });

    const choice = response?.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
        // A reasoning model that runs out of budget returns an empty message
        // with finish_reason "length" rather than truncated JSON.
        throw new Error(
            choice?.finish_reason === 'length'
                ? 'The analysis ran long. Try again, or add a note about what is on the plate.'
                : 'No analysis came back. Try again.'
        );
    }

    let raw: any;
    try {
        raw = JSON.parse(content);
    } catch {
        throw new Error('The analysis came back malformed. Try again.');
    }

    if (raw.is_food === false) throw new NotFoodError();

    const stamp = Date.now();
    const items: ScannedItem[] = (Array.isArray(raw.items) ? raw.items : [])
        .map((it: any, i: number) => ({
            id: `scan-${stamp}-${i}`,
            name: String(it?.name || '').trim() || 'Food',
            portion: String(it?.portion || '').trim(),
            grams: Math.round(num(it?.grams)),
            calories: Math.round(num(it?.calories)),
            protein: Math.round(num(it?.protein_g)),
            carbs: Math.round(num(it?.carbs_g)),
            fat: Math.round(num(it?.fat_g)),
            confidence: confidenceOf(it?.confidence),
            note: String(it?.note || '').trim(),
            menuMatch: it?.menu_match === true,
            fromLabel: it?.from_label === true,
        }))
        .filter((it: ScannedItem) => it.calories > 0 || it.protein > 0 || it.carbs > 0 || it.fat > 0);

    if (items.length === 0) throw new NotFoodError();

    const total = scanTotals(items).calories;
    let low = Math.round(num(raw.calorie_range?.low));
    let high = Math.round(num(raw.calorie_range?.high));
    // The range has to contain the itemised total or it is meaningless.
    if (!(low > 0 && high >= low)) {
        low = Math.round(total * 0.8);
        high = Math.round(total * 1.2);
    }
    low = Math.min(low, total);
    high = Math.max(high, total);

    const strings = (v: unknown, max: number): string[] =>
        (Array.isArray(v) ? v : [])
            .map((s) => String(s || '').trim())
            .filter(Boolean)
            .slice(0, max);

    return {
        mealName: String(raw.meal_name || '').trim() || 'Scanned meal',
        items,
        calorieRange: { low, high },
        confidence: confidenceOf(raw.confidence),
        assumptions: strings(raw.assumptions, 6),
        questions: strings(raw.questions, 2),
    };
}

/**
 * Turn a scanned item into a loggable FoodItem. The user's portion scaling is
 * baked into the values so the log shows what was actually eaten and the
 * existing amount/unit editor still works on top of it.
 */
export function scannedItemToFood(item: ScannedItem, scale = 1): FoodItem {
    const grams = Math.round(item.grams * scale);
    const portion = scale === 1 ? item.portion : `${item.portion} x${formatScale(scale)}`;
    return {
        id: `${item.id}-${Math.round(scale * 100)}`,
        name: item.name,
        calories: Math.round(item.calories * scale),
        protein: Math.round(item.protein * scale),
        carbs: Math.round(item.carbs * scale),
        fat: Math.round(item.fat * scale),
        servingSize: portion || (grams > 0 ? `~${grams} g` : undefined),
        baseUnit: 'serving',
        baseAmount: 1,
        tags: [item.fromLabel ? 'Label' : 'AI Scan'],
        category: 'Meal Scan',
    };
}

export function formatScale(scale: number): string {
    return Number.isInteger(scale) ? String(scale) : scale.toFixed(2).replace(/0$/, '');
}
