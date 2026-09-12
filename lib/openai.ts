/**
 * OpenAI integration — every call goes through the Supabase Edge Function at
 * supabase/functions/openai-proxy, which holds the API key and verifies the
 * caller's Supabase JWT before forwarding.
 *
 * Nothing in the client may read an OpenAI key. Expo inlines every
 * EXPO_PUBLIC_* value into the JS bundle at build time, so a key read here
 * ships inside the app and can be pulled straight out of any build handed to
 * a tester. The key belongs in the function's secrets and nowhere else.
 */
import { supabase } from './supabase';
import { formatGymContextForAI, resolveTrainingLocation } from './gymContext';
import { getExerciseLibraryPromptSection } from '@/features/workout/exerciseResolver';
import { DEFAULT_GYMS } from '@/types/user';

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string;
}

const SYSTEM_PROMPT = `You are the Leprechaun AI — a warm, shame-free fitness guide for Notre Dame students. ☘️
Your vibe: positive energy, curiosity, and "showing up counts." Never guilt, never shame about missed days or broken streaks.

CORE BELIEFS:
- Any movement is a win: 10–20 minutes still matters.
- Fitness is learned over time — explain ONE simple idea per reply (protein, recovery, form, sleep).
- Missed yesterday? Today is still a good day. Never say they "failed," "fell off," or "lost discipline."
- Avoid drill-sergeant tone. No "crush," "elite," "no excuses," or punishment language.

BEFORE BUILDING A WORKOUT, gently learn:
1. Focus: what body area or goal today?
2. Location: Duncan, Rockne, dorm gym, or home/bodyweight?
3. Time: how many minutes (honor low time — offer short options).
4. Safety: injuries or experience if not in user context.

WORKOUT RULES:
- When building a workout plan, you MUST call start_workout with workoutPlan filled in.
- Use ONLY exercise names from the EXERCISE LIBRARY below — exact spelling, including parentheses where listed.
- NEVER invent exercise names. If equipment is missing at their gym, pick a library alternative (e.g. Goblet Squat instead of Barbell Squat).
- Typical plan: 4–8 exercises, 3–4 sets each, targetReps like "8-12" or "5".
- ONLY use equipment at their ACTIVE training location (see gym context below — it updates when they change location in the app).
- Celebrate effort; suggest the smallest next step if they're tired or new.

CAMPUS FLAVOR (light touch):
Reference ND spots when natural — Duncan, Rockne, dining halls, the Grotto — without being cheesy every sentence.

Keep replies concise, kind, and practical. Teach a little, encourage a lot.`;

/**
 * Send a chat-completion request through the edge proxy.
 *
 * `body` is the OpenAI request shape (messages, tools, response_format…);
 * the proxy forwards it and returns OpenAI's response unchanged, so callers
 * read `choices[0].message` exactly as before. The Supabase client attaches
 * the signed-in user's access token, which is what the proxy authenticates.
 */
export const callProxy = async (body: any): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('openai-proxy', { body });

    if (error) {
        // A non-2xx from the function surfaces as FunctionsHttpError, whose
        // message is just the status line — the useful text is in the response
        // body, which the client hands back untouched on `context`.
        let detail = error.message;
        const res = (error as { context?: Response }).context;
        if (res && typeof res.json === 'function') {
            try {
                const payload = await res.json();
                detail = payload?.details || payload?.error || detail;
            } catch {
                // Body was not JSON; the original message stands.
            }
        }
        console.error('❌ AI Backend Error:', detail);
        throw new Error(detail);
    }

    return data;
};

export const getLeprechaunResponse = async (messages: Message[]): Promise<string | null> => {
    try {
        const data = await callProxy({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...messages
            ],
            temperature: 0.7,
            max_tokens: 250,
        });

        return data?.choices?.[0]?.message?.content ?? null;
    } catch (error) {
        console.error('getLeprechaunResponse error:', error);
        return "☘️ Och! Something's gone wrong with the magic. Try again later, lad!";
    }
};

const TOOLS = [
    {
        type: "function",
        function: {
            name: "update_fitness_goal",
            description: "Update the user's fitness goal. Use this to change their goal based on their request.",
            parameters: {
                type: "object",
                properties: {
                    goal: {
                        type: "string",
                        description: "The targeted fitness goal",
                        enum: ["Cut (Lose Fat)", "Maintain", "Lean Bulk", "Bulk (Gain Size)", "Endurance / Performance"]
                    }
                },
                required: ["goal"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_weight",
            description: "Update the user's body weight in kg.",
            parameters: {
                type: "object",
                properties: {
                    weightKg: {
                        type: "number",
                        description: "The user's new target or current weight in kg"
                    }
                },
                required: ["weightKg"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_gym",
            description: "Update the user's preferred or default gym on campus.",
            parameters: {
                type: "object",
                properties: {
                    gym: {
                        type: "string",
                        description: "The user's preferred gym",
                        enum: [DEFAULT_GYMS.DUNCAN, DEFAULT_GYMS.ROCKNE, DEFAULT_GYMS.HOME]
                    }
                },
                required: ["gym"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_display_name",
            description: "Update the user's display name or username.",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "The user's new display name"
                    }
                },
                required: ["name"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "start_workout",
            description: "Create a structured workout plan for the user. REQUIRED when they ask for a workout, routine, or training session. Exercise names must match the library exactly.",
            parameters: {
                type: "object",
                properties: {
                    workoutType: {
                        type: "string",
                        description: "The type of workout (e.g. Push, Pull, Legs, Upper, Lower, Full Body)"
                    },
                    durationMinutes: {
                        type: "number",
                        description: "Duration in minutes"
                    },
                    location: {
                        type: "string",
                        description: "Gym location name"
                    },
                    workoutPlan: {
                        type: "object",
                        description: "The full structured workout plan",
                        properties: {
                            name: { type: "string", description: "Workout title e.g. Push Day — Duncan" },
                            exercises: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: {
                                            type: "string",
                                            description: "EXACT name from exercise library e.g. Bench Press (Barbell)"
                                        },
                                        setsCount: { type: "number", description: "Number of working sets (2-5)" },
                                        targetReps: { type: "string", description: "e.g. '8-12', '5', '12-15'" },
                                        notes: { type: "string", description: "Optional form or tempo cue" }
                                    },
                                    required: ["name", "setsCount", "targetReps"]
                                }
                            }
                        },
                        required: ["name", "exercises"]
                    }
                },
                required: ["workoutType", "durationMinutes", "workoutPlan"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_training_split",
            description: "Update the user's preferred workout training split.",
            parameters: {
                type: "object",
                properties: {
                    split: {
                        type: "string",
                        description: "The targeted training split",
                        enum: ["Push / Pull / Legs", "Upper / Lower", "Full Body", "Bro Split (Body Part)", "Custom / AI Managed"]
                    }
                },
                required: ["split"],
            },
        },
    },
];

export const getLeprechaunResponseWithTools = async (
    messages: Message[],
    userContext?: any,
    options?: { forceWorkoutPlan?: boolean }
) => {
    try {
        let systemPrompt = SYSTEM_PROMPT;
        
        if (userContext) {
            const trainingLocation =
                userContext.activeTrainingLocation ||
                resolveTrainingLocation({
                    dorm: userContext.dorm,
                    defaultGym: userContext.defaultGym,
                }) ||
                userContext.defaultGym ||
                DEFAULT_GYMS.DUNCAN;

            systemPrompt += `\n\n[USER BIO & CONTEXT]
Display Name: ${userContext.displayName || 'Friend'}
Goal: ${userContext.goal || 'Elite Fitness'}
Split: ${userContext.trainingSplit || 'PPL'}
Exp Level: ${userContext.experienceLevel || 'Intermediate'}
Injuries: ${userContext.injuries || 'None reported'}
Favorite Exercises: ${userContext.likedExercises || 'Not set'}
Disliked Exercises: ${userContext.dislikedExercises || 'Not set'}

${formatGymContextForAI(trainingLocation)}

When the user wants a workout, call start_workout with a complete workoutPlan. Use ONLY library exercise names.
If a PENDING WORKOUT PLAN exists below, the user may ask to swap exercises, change sets/reps, or shorten the session — call start_workout again with the updated plan (do not tell them to leave the app).
If they say "start", "begin", "let's go", or confirm they're ready, call start_workout with the current plan (incorporate any changes from chat).

${getExerciseLibraryPromptSection()}`;

            if (userContext.pendingWorkout) {
                const pw = userContext.pendingWorkout;
                const lines = (pw.exercises || [])
                    .map(
                        (e: { name: string; sets: number; targetReps: string }) =>
                            `- ${e.name}: ${e.sets} sets × ${e.targetReps}`
                    )
                    .join('\n');
                systemPrompt += `\n\n[PENDING WORKOUT PLAN — "${pw.name}"]
${lines}
The user has NOT started yet. They may refine this plan via chat or confirm start.`;
            }
        }

        const data = await callProxy({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            tools: TOOLS,
            tool_choice: options?.forceWorkoutPlan
                ? { type: 'function', function: { name: 'start_workout' } }
                : 'auto',
            temperature: 0.6,
            max_tokens: 900,
        });

        const message = data?.choices?.[0]?.message;
        if (!message) throw new Error('No message in OpenAI response');

        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0] as any;
            return {
                type: 'action',
                functionName: toolCall.function.name,
                args: JSON.parse(toolCall.function.arguments || "{}"),
                toolCallId: toolCall.id,
                message: message
            };
        }

        return {
            type: 'text',
            content: message.content,
            message: message
        };
    } catch (error) {
        console.error('getLeprechaunResponseWithTools error:', error);
        return {
            type: 'text',
            content: "☘️ Och! Something's gone wrong with the magic. Try again later, lad!"
        };
    }
};
