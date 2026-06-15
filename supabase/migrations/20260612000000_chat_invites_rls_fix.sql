-- Allow invitees to read chat metadata for pending invites (needed for Requests UI)

DROP POLICY IF EXISTS "Pending invitees read chats" ON public.chats;
CREATE POLICY "Pending invitees read chats" ON public.chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.chat_invites ci
            WHERE ci.chat_id = id
              AND ci.invitee_id = auth.uid()
              AND ci.status = 'pending'
        )
    );

-- Inviters can update their pending invites (e.g. cancel) — optional future use
DROP POLICY IF EXISTS "Inviters read sent chat invites" ON public.chat_invites;
-- (read policy already covers inviter_id)

-- Realtime for invite notifications in Messages
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_invites;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reliable pending-invites fetch (avoids fragile client joins)
CREATE OR REPLACE FUNCTION public.get_my_pending_chat_invites()
RETURNS TABLE (
    id UUID,
    chat_id UUID,
    inviter_id UUID,
    inviter_name TEXT,
    chat_type TEXT,
    group_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        ci.id,
        ci.chat_id,
        ci.inviter_id,
        COALESCE(p.display_name, 'Someone') AS inviter_name,
        c.type AS chat_type,
        c.name AS group_name,
        ci.created_at
    FROM public.chat_invites ci
    JOIN public.chats c ON c.id = ci.chat_id
    JOIN public.profiles p ON p.id = ci.inviter_id
    WHERE ci.invitee_id = auth.uid()
      AND ci.status = 'pending'
    ORDER BY ci.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_chat_invites() TO authenticated;
