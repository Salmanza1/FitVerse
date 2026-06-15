import { callProxy } from '@/lib/openai';

export type ActivityCategory = 'sport' | 'cardio' | 'recovery' | 'outdoor' | 'other';
export type ActivityIntensity = 'light' | 'moderate' | 'vigorous';

export interface ActivityLogEstimate {
    activityName: string;
    category: ActivityCategory;
    durationMinutes: number;
    intensity: ActivityIntensity;
    /** Compendium of Physical Activities MET (3.5–12 typical) */
    met: number;
    caloriesBurned?: number;
    confidence: number;
    insight: string;
    assumptions?: string;
}

const ACTIVITY_LOG_SYSTEM = `You parse plain-English activity descriptions into structured workout logs for college students.
Activities include sports (basketball, soccer, volleyball), cardio (running, cycling, swimming), outdoor (hiking, walking), recovery (yoga, stretching), and casual movement.

Rules:
- Combine the user's message into ONE activity entry.
- If duration is missing, infer a reasonable default (e.g. pickup basketball → 45 min, walk → 30 min) and note it in assumptions.
- Pick a realistic MET from the Compendium of Physical Activities (basketball game ~6–8, walking ~3.5, yoga ~2.5, running ~9, lifting is NOT your job — only non-gym-session activities).
- intensity: light | moderate | vigorous
- category: sport | cardio | recovery | outdoor | other
- activityName: short label (max 5 words), title case e.g. "Pickup Basketball"
- Be encouraging, no guilt.

Return ONLY JSON:
{
  "activityName": string,
  "category": "sport" | "cardio" | "recovery" | "outdoor" | "other",
  "durationMinutes": number,
  "intensity": "light" | "moderate" | "vigorous",
  "met": number,
  "confidence": 0.0-1.0,
  "insight": "One warm sentence confirming what you logged",
  "assumptions": "Brief note on duration/intensity guesses if any"
}`;

export const estimateActivityFromDescription = async (
    description: string
): Promise<ActivityLogEstimate> => {
    const trimmed = description.trim();
    if (!trimmed) {
        throw new Error('Describe what you did first.');
    }

    const response = await callProxy({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: ACTIVITY_LOG_SYSTEM },
            { role: 'user', content: trimmed },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 400,
        temperature: 0.35,
    });

    const content = response.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}') as Partial<ActivityLogEstimate>;

    if (!parsed.activityName || parsed.durationMinutes == null) {
        throw new Error('Could not parse that activity. Try adding duration, e.g. "basketball for 45 minutes".');
    }

    const durationMinutes = Math.max(5, Math.min(300, Math.round(Number(parsed.durationMinutes) || 30)));
    const met = Math.max(2, Math.min(14, Number(parsed.met) || 5));

    return {
        activityName: parsed.activityName,
        category: parsed.category ?? 'other',
        durationMinutes,
        intensity: parsed.intensity ?? 'moderate',
        met,
        caloriesBurned: parsed.caloriesBurned
            ? Math.round(Number(parsed.caloriesBurned))
            : undefined,
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.6)),
        insight: parsed.insight || `Logged ${parsed.activityName} — nice work staying active.`,
        assumptions: parsed.assumptions,
    };
};
