// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declare Deno to satisfy TypeScript when the Deno extension is not active in the IDE
declare const Deno: any;

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('☘️ Edge Function: openai-proxy triggered');

        // Verify the user is authenticated via Supabase JWT
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('❌ Missing Authorization header');
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            console.error('❌ Auth Verification Failed:', authError);
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('✅ User Authenticated:', user.email);

        // Forward request body to OpenAI
        const body = await req.json();
        const { messages, tools, tool_choice = 'auto', temperature = 0.7, max_tokens = 500 } = body;

        console.log(`🔄 Forwarding to OpenAI (Model: gpt-4o-mini, Messages: ${messages?.length || 0})`);

        const requestBody: any = {
            model: 'gpt-4o-mini',
            messages,
            temperature,
            max_tokens,
        };

        if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = tool_choice;
        }

        const openaiResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            },
            body: JSON.stringify(requestBody),
        });

        const openaiData = await openaiResponse.json();

        if (!openaiResponse.ok) {
            console.error('OpenAI Error:', openaiData);
            return new Response(JSON.stringify({ 
                error: 'OpenAI API Error', 
                details: openaiData.error?.message || 'Unknown OpenAI error',
                status: openaiResponse.status 
            }), {
                status: openaiResponse.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(openaiData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
