// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declare Deno to satisfy TypeScript when the Deno extension is not active in the IDE
declare const Deno: any;

/**
 * OpenAI proxy.
 *
 * The API key lives here and only here. The client sends the OpenAI request
 * shape; this verifies the caller's Supabase JWT, forwards the parts it allows,
 * and returns OpenAI's response unchanged.
 *
 * Set the key with:  npx supabase secrets set --env-file supabase/.env
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Models the client may ask for. An allowlist rather than a passthrough: the
 * caller is authenticated but not trusted, and a request for a large model is
 * billed to this account at many times the rate of the one the app uses.
 *
 * The gpt-5.6 tier is for the meal scanner, which needs a strong vision
 * model — model choice is the single biggest lever on portion and calorie
 * accuracy in the published benchmarks. Chat and the text estimators stay on
 * gpt-4o-mini.
 */
const ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'];
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * gpt-5.x and later are reasoning models: they take max_completion_tokens
 * (which also counts hidden reasoning tokens) and reasoning_effort, and
 * reject temperature.
 */
const isReasoningModel = (model: string) => /^gpt-(5[.][0-9]|6)/.test(model);
const ALLOWED_REASONING_EFFORT = ['none', 'minimal', 'low', 'medium', 'high'];

/** Ceilings on a single completion, for the same billing reason. */
const MAX_OUTPUT_TOKENS = 1200;
/**
 * Higher for reasoning models because the budget is shared with reasoning;
 * a ceiling that only fits the visible JSON would come back empty.
 */
const MAX_REASONING_OUTPUT_TOKENS = 8000;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Verify the user is authenticated via Supabase JWT
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('❌ Missing Authorization header');
            return json({ error: 'Missing Authorization header' }, 401);
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            console.error('❌ Auth verification failed:', authError?.message);
            return json({ error: 'Unauthorized' }, 401);
        }

        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
            console.error('❌ OPENAI_API_KEY is not set on this function');
            return json({ error: 'AI is not configured on the server' }, 500);
        }

        // Forward the request to OpenAI. Only these fields cross over; anything
        // else the client sends is ignored rather than billed.
        const body = await req.json();
        const {
            model,
            messages,
            tools,
            tool_choice = 'auto',
            response_format,
            temperature = 0.7,
            max_tokens = 500,
            max_completion_tokens,
            reasoning_effort,
        } = body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return json({ error: 'messages is required' }, 400);
        }

        const resolvedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;
        const requestedTokens = Number(max_completion_tokens ?? max_tokens) || 500;

        const requestBody: Record<string, unknown> = {
            model: resolvedModel,
            messages,
        };

        if (isReasoningModel(resolvedModel)) {
            requestBody.max_completion_tokens = Math.min(requestedTokens, MAX_REASONING_OUTPUT_TOKENS);
            if (ALLOWED_REASONING_EFFORT.includes(reasoning_effort)) {
                requestBody.reasoning_effort = reasoning_effort;
            }
        } else {
            requestBody.temperature = temperature;
            requestBody.max_tokens = Math.min(requestedTokens, MAX_OUTPUT_TOKENS);
        }

        if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = tool_choice;
        }

        // Needed by the nutrition and activity estimators, which JSON.parse the
        // reply — without it the model is free to wrap the object in prose.
        if (response_format) {
            requestBody.response_format = response_format;
        }

        // user.id, not user.email: function logs are retained, and the address
        // adds nothing to a trace that the id doesn't.
        console.log(`🔄 openai-proxy → ${requestBody.model} for ${user.id} (${messages.length} messages)`);

        const openaiResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        const openaiData = await openaiResponse.json();

        if (!openaiResponse.ok) {
            console.error('OpenAI error:', openaiData?.error?.message);
            return json(
                {
                    error: 'OpenAI API Error',
                    details: openaiData?.error?.message || 'Unknown OpenAI error',
                    status: openaiResponse.status,
                },
                openaiResponse.status
            );
        }

        return json(openaiData, 200);
    } catch (err) {
        console.error('openai-proxy failed:', err);
        return json({ error: String(err) }, 500);
    }
});
