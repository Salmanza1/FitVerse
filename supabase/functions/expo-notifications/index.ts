// @ts-nocheck
// ↑ Deno Edge Function — TypeScript errors here are IDE false-positives.
//   This file runs in Deno (not Node.js) and is excluded from the root tsconfig.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

/**
 * Supabase Edge Function: expo-notifications
 * 
 * This function handles database webhooks for `messages` and `friendships` 
 * and securely triggers push notifications via the Expo Push API.
 */

serve(async (req) => {
    try {
        const payload = await req.json()

        // 1. Initialize Supabase Admin Client
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        )

        let title = "New Notification"
        let body = "You have a new update in FitVerse."
        let targetUserId = ""

        // 2. Parse Payload from Webhooks
        if (payload.table === 'messages' && payload.type === 'INSERT') {
            const message = payload.record;

            // Extract sender display name
            const { data: sender } = await supabaseClient
                .from('profiles')
                .select('name, display_name')
                .eq('id', message.sender_id)
                .single()

            const senderName = sender?.display_name || sender?.name || 'Someone'
            title = `New text from ${senderName}`
            body = message.content || "Sent an attachment."

            // Extract the target participant (the person receiving the DM)
            // Assuming a 1-on-1 chat logic for now, or broadcast to all participants in group.
            const { data: participants } = await supabaseClient
                .from('chat_participants')
                .select('user_id')
                .eq('chat_id', message.chat_id)
                .neq('user_id', message.sender_id)

            if (participants && participants.length > 0) {
                // For simplicity, targeting the first other user
                targetUserId = participants[0].user_id
            }

        } else if (payload.table === 'friendships') {
            const friendship = payload.record;

            if (friendship.status === 'pending' && payload.type === 'INSERT') {
                const { data: sender } = await supabaseClient
                    .from('profiles')
                    .select('name, display_name')
                    .eq('id', friendship.requester_id)
                    .single()

                const senderName = sender?.display_name || sender?.name || 'Someone'
                title = "New Friend Request"
                body = `${senderName} wants to be your gym buddy.`
                targetUserId = friendship.receiver_id

            } else if (friendship.status === 'accepted' && payload.type === 'UPDATE') {
                const { data: receiver } = await supabaseClient
                    .from('profiles')
                    .select('name, display_name')
                    .eq('id', friendship.receiver_id)
                    .single()

                const receiverName = receiver?.display_name || receiver?.name || 'Someone'
                title = "Friend Request Accepted!"
                body = `${receiverName} accepted your friend request.`
                targetUserId = friendship.requester_id
            }
        }

        if (!targetUserId) {
            return new Response(JSON.stringify({ message: "No valid target user ID to ping." }), { status: 200 })
        }

        // 3. Look up target user's Expo Push Token
        const { data: targetProfile, error: profileErr } = await supabaseClient
            .from('profiles')
            .select('push_token, push_notifications')
            .eq('id', targetUserId)
            .single()

        if (profileErr || !targetProfile) {
            return new Response(JSON.stringify({ message: "Target profile missing", error: profileErr }), { status: 200 })
        }

        // Abort if push token missing or user disabled notifications
        if (!targetProfile.push_token || targetProfile.push_notifications === false) {
            return new Response(JSON.stringify({ message: "Push token missing or explicitly disabled." }), { status: 200 })
        }

        // 4. Send to Expo Push Service
        const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: targetProfile.push_token,
                sound: 'default',
                title: title,
                body: body,
                badge: 1, // Increments badge count natively
                data: { table: payload.table, recordId: payload.record.id },
            }),
        });

        const expoData = await expoResponse.json()

        return new Response(
            JSON.stringify({ success: true, expoData }),
            { headers: { "Content-Type": "application/json" } }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
            { headers: { "Content-Type": "application/json" }, status: 500 }
        )
    }
})
