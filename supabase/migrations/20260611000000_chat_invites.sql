-- Chat invites: recipients must accept before joining a DM or group chat

CREATE TABLE IF NOT EXISTS public.chat_invites (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id         UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    inviter_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invitee_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at    TIMESTAMPTZ,
    UNIQUE (chat_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS chat_invites_invitee_pending_idx
    ON public.chat_invites (invitee_id, created_at DESC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS chat_invites_chat_id_idx
    ON public.chat_invites (chat_id);

ALTER TABLE public.chat_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own chat invites" ON public.chat_invites;
CREATE POLICY "Users read own chat invites" ON public.chat_invites
    FOR SELECT USING (auth.uid() IN (inviter_id, invitee_id));

-- Inserts/updates happen via security-definer RPCs only

CREATE OR REPLACE FUNCTION public.are_friends(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.friendships
        WHERE status = 'accepted'
          AND (
              (requester_id = p_user_a AND receiver_id = p_user_b)
              OR (requester_id = p_user_b AND receiver_id = p_user_a)
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.create_chat_with_invites(
    p_type TEXT,
    p_group_name TEXT DEFAULT NULL,
    p_invitee_ids UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_creator UUID := auth.uid();
    v_chat_id UUID;
    v_invitee UUID;
    v_existing_chat UUID;
BEGIN
    IF v_creator IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_type NOT IN ('direct', 'group') THEN
        RAISE EXCEPTION 'Invalid chat type';
    END IF;

    IF p_type = 'direct' THEN
        IF array_length(p_invitee_ids, 1) IS DISTINCT FROM 1 THEN
            RAISE EXCEPTION 'Direct chat requires exactly one invitee';
        END IF;

        v_invitee := p_invitee_ids[1];

        IF NOT public.are_friends(v_creator, v_invitee) THEN
            RAISE EXCEPTION 'You must be friends to start a chat';
        END IF;

        -- Fully active DM (both members)
        SELECT c.id INTO v_existing_chat
        FROM public.chats c
        JOIN public.chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = v_creator
        JOIN public.chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id = v_invitee
        WHERE c.type = 'direct'
        LIMIT 1;

        IF v_existing_chat IS NOT NULL THEN
            RETURN v_existing_chat;
        END IF;

        -- Pending invite already sent by this user
        SELECT ci.chat_id INTO v_existing_chat
        FROM public.chat_invites ci
        JOIN public.chats c ON c.id = ci.chat_id
        WHERE ci.inviter_id = v_creator
          AND ci.invitee_id = v_invitee
          AND ci.status = 'pending'
          AND c.type = 'direct'
        LIMIT 1;

        IF v_existing_chat IS NOT NULL THEN
            RETURN v_existing_chat;
        END IF;
    ELSE
        IF p_group_name IS NULL OR trim(p_group_name) = '' THEN
            RAISE EXCEPTION 'Group name required';
        END IF;

        IF p_invitee_ids IS NULL OR array_length(p_invitee_ids, 1) < 1 THEN
            RAISE EXCEPTION 'Select at least one friend';
        END IF;

        FOREACH v_invitee IN ARRAY p_invitee_ids LOOP
            IF NOT public.are_friends(v_creator, v_invitee) THEN
                RAISE EXCEPTION 'All members must be your friends';
            END IF;
        END LOOP;
    END IF;

    INSERT INTO public.chats (type, name)
    VALUES (
        p_type,
        CASE WHEN p_type = 'group' THEN trim(p_group_name) ELSE NULL END
    )
    RETURNING id INTO v_chat_id;

    INSERT INTO public.chat_participants (chat_id, user_id)
    VALUES (v_chat_id, v_creator)
    ON CONFLICT DO NOTHING;

    FOREACH v_invitee IN ARRAY p_invitee_ids LOOP
        INSERT INTO public.chat_invites (chat_id, inviter_id, invitee_id)
        VALUES (v_chat_id, v_creator, v_invitee)
        ON CONFLICT (chat_id, invitee_id) DO NOTHING;
    END LOOP;

    RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_chat_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invite public.chat_invites%ROWTYPE;
BEGIN
    SELECT * INTO v_invite
    FROM public.chat_invites
    WHERE id = p_invite_id
      AND invitee_id = auth.uid()
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or already handled';
    END IF;

    INSERT INTO public.chat_participants (chat_id, user_id)
    VALUES (v_invite.chat_id, auth.uid())
    ON CONFLICT DO NOTHING;

    UPDATE public.chat_invites
    SET status = 'accepted', responded_at = now()
    WHERE id = p_invite_id;

    RETURN v_invite.chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_chat_invite(p_invite_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.chat_invites
    SET status = 'declined', responded_at = now()
    WHERE id = p_invite_id
      AND invitee_id = auth.uid()
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or already handled';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_chat_with_invites(TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chat_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_chat_invite(UUID) TO authenticated;
