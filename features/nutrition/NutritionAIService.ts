import { callProxy } from '@/lib/openai';
import { FoodItem } from '@/types/nutrition';

export interface QuickFoodEstimate {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize: string;
    baseUnit: string;
    baseAmount: number;
    confidence: number;
    insight: string;
    breakdown?: string;
}

const QUICK_ESTIMATE_SYSTEM = `You estimate nutrition for meals described in plain English.
The user did NOT eat from a dining hall database — use typical portions, chain-restaurant averages, and common serving sizes when brands are named (Chipotle, Jimmy John's, Starbucks, etc.).
Combine everything they ate into ONE log entry with total macros for the full description.
Be realistic and slightly conservative when unsure — never return zeros unless truly negligible.
Return ONLY JSON:
{
  "name": "Short meal label (max 6 words)",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "servingSize": "human-readable portion e.g. 1 bowl",
  "baseUnit": "serving",
  "baseAmount": 1,
  "confidence": 0.0-1.0,
  "insight": "One warm, practical sentence — no guilt",
  "breakdown": "Brief assumptions (portions, brand defaults)"
}`;

export function estimateToFoodItem(estimate: QuickFoodEstimate): FoodItem {
    return {
        id: `ai-est-${Date.now()}`,
        name: estimate.name,
        calories: Math.round(estimate.calories),
        protein: Math.round(estimate.protein),
        carbs: Math.round(estimate.carbs),
        fat: Math.round(estimate.fat),
        servingSize: estimate.servingSize,
        baseUnit: estimate.baseUnit || 'serving',
        baseAmount: estimate.baseAmount || 1,
        tags: ['AI Estimate'],
        category: 'Quick Estimate',
    };
}

export const estimateFoodFromDescription = async (description: string): Promise<QuickFoodEstimate> => {
    const trimmed = description.trim();
    if (!trimmed) {
        throw new Error('Describe what you ate first.');
    }

    const response = await callProxy({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: QUICK_ESTIMATE_SYSTEM },
            { role: 'user', content: trimmed },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 450,
        temperature: 0.35,
    });

    const content = response.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}') as Partial<QuickFoodEstimate>;

    if (!parsed.name || parsed.calories == null) {
        throw new Error('Could not parse an estimate. Try adding more detail.');
    }

    return {
        name: parsed.name,
        calories: Math.round(Number(parsed.calories) || 0),
        protein: Math.round(Number(parsed.protein) || 0),
        carbs: Math.round(Number(parsed.carbs) || 0),
        fat: Math.round(Number(parsed.fat) || 0),
        servingSize: parsed.servingSize || '1 serving',
        baseUnit: parsed.baseUnit || 'serving',
        baseAmount: parsed.baseAmount || 1,
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        insight: parsed.insight || 'Logged as an AI estimate — adjust if you know the exact macros.',
        breakdown: parsed.breakdown,
    };
};
