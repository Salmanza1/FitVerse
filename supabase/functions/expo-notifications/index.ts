// @ts-nocheck
// ↑ Deno Edge Function — TypeScript errors here are IDE false-positives.
//   This file runs in Deno (not Node.js) and is excluded from the root tsconfig.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

/**
 * Push notifications for new messages and friend requests.
 *
 * Called by database triggers on `messages` and `friendships` (see the
 * migration that creates them), which post the row that changed. The trigger
 * is the only caller, so the request is authenticated with a shared secret
 * rather than a user JWT — this endpoint runs with verify_jwt off, and
 * without the check anyone could send any FitVerse user a notification.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
/** Expo accepts up to 100 messages per request. */
const EXPO_BATCH = 100
/** A notification body is a preview, not the whole message. */
const BODY_MAX = 140

const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const displayName = (p?: { name?: string; display_name?: string } | null) =>
    p?.display_name || p?.name || 'Someone'

const preview = (text?: string | null) => {
    const t = (text ?? '').trim()
    if (!t) return 'Sent an attachment.'
    return t.length > BODY_MAX ? `${t.slice(0, BODY_MAX - 1)}…` : t
}

serve(async (req) => {
    try {
        const secret = Deno.env.get('NOTIFY_HOOK_SECRET')
        // Fail closed. An unset secret means the function is misconfigured, and
        // serving it open is worse than serving nothing.
        if (!secret) {
            console.error('NOTIFY_HOOK_SECRET is not set on this function')
            return json({ error: 'Not configured' }, 500)
        }
        if (req.headers.get('x-notify-secret') !== secret) {
            return json({ error: 'Unauthorized' }, 401)
        }

        const payload = await req.json()
        const record = payload?.record
        if (!record) return json({ message: 'No record on payload' })

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let title = ''
        let body = ''
        let targetUserIds: string[] = []
        const data: Record<string, unknown> = { table: payload.table, recordId: record.id }

        if (payload.table === 'messages' && payload.type === 'INSERT') {
            const [{ data: sender }, { data: chat }, { data: participants }] = await Promise.all([
                supabaseClient
                    .from('profiles')
                    .select('name, display_name')
                    .eq('id', record.sender_id)
                    .maybeSingle(),
                supabaseClient
                    .from('chats')
                    .select('type, name')
                    .eq('id', record.chat_id)
                    .maybeSingle(),
                // Everyone in the room except whoever sent it.
                supabaseClient
                    .from('chat_participants')
                    .select('user_id')
                    .eq('chat_id', record.chat_id)
                    .neq('user_id', record.sender_id),
            ])

            const senderName = displayName(sender)
            // In a group the room is the thing you recognise, so name it.
            title =
                chat?.type === 'group' && chat?.name
                    ? `${senderName} in ${chat.name}`
                    : senderName
            body = preview(record.content)
            targetUserIds = (participants ?? []).map((p) => p.user_id)
            data.chatId = record.chat_id

        } else if (payload.table === 'friendships') {
            if (payload.type === 'INSERT' && record.status === 'pending') {
                const { data: requester } = await supabaseClient
                    .from('profiles')
                    .select('name, display_name')
                    .eq('id', record.requester_id)
                    .maybeSingle()

                title = 'New friend request'
                body = `${displayName(requester)} wants to be your gym buddy.`
                targetUserIds = [record.receiver_id]

            } else if (payload.type === 'UPDATE' && record.status === 'accepted') {
                // Only tell the requester, and only when this update is what
                // changed the status — otherwise every later edit re-notifies.
                if (payload.old_record?.status === 'accepted') {
                    return json({ message: 'Already accepted; nothing to send.' })
                }
                const { data: receiver } = await supabaseClient
                    .from('profiles')
                    .select('name, display_name')
                    .eq('id', record.receiver_id)
                    .maybeSingle()

                title = 'Friend request accepted'
                body = `${displayName(receiver)} accepted your friend request.`
                targetUserIds = [record.requester_id]
            }
        }

        targetUserIds = Array.from(new Set(targetUserIds.filter(Boolean)))
        if (targetUserIds.length === 0 || !title) {
            return json({ message: 'Nothing to send.' })
        }

        const { data: targets, error: profileErr } = await supabaseClient
            .from('profiles')
            .select('id, push_token, push_notifications')
            .in('id', targetUserIds)

        if (profileErr) return json({ message: 'Lookup failed', error: profileErr.message })

        const messages = (targets ?? [])
            .filter((t) => t.push_token && t.push_notifications !== false)
            .map((t) => ({
                to: t.push_token,
                sound: 'default',
                title,
                body,
                badge: 1,
                data,
            }))

        if (messages.length === 0) {
            return json({ message: 'No reachable recipients.' })
        }

        const results: unknown[] = []
        for (let i = 0; i < messages.length; i += EXPO_BATCH) {
            const res = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages.slice(i, i + EXPO_BATCH)),
            })
            results.push(await res.json())
        }

        return json({ success: true, sent: messages.length, results })
    } catch (err) {
        console.error('expo-notifications failed:', err)
        return json({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
})
