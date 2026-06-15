-- Chat social: reactions, gym-together invites, milestone messages.

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages
    ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN ('text', 'gym_invite', 'milestone'));

CREATE TABLE IF NOT EXISTS public.message_reactions (
    message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji       TEXT NOT NULL CHECK (char_length(emoji) <= 8),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx
    ON public.message_reactions (message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read message reactions" ON public.message_reactions;
CREATE POLICY "Members read message reactions" ON public.message_reactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.messages m
            JOIN public.chat_participants cp ON cp.chat_id = m.chat_id
            WHERE m.id = message_reactions.message_id
              AND cp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members react to messages" ON public.message_reactions;
CREATE POLICY "Members react to messages" ON public.message_reactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1
            FROM public.messages m
            JOIN public.chat_participants cp ON cp.chat_id = m.chat_id
            WHERE m.id = message_reactions.message_id
              AND cp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users update own reactions" ON public.message_reactions;
CREATE POLICY "Users update own reactions" ON public.message_reactions
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove own reactions" ON public.message_reactions;
CREATE POLICY "Users remove own reactions" ON public.message_reactions
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members respond to gym invites" ON public.messages;
CREATE POLICY "Members respond to gym invites" ON public.messages
    FOR UPDATE USING (
        message_type = 'gym_invite'
        AND EXISTS (
            SELECT 1 FROM public.chat_participants cp
            WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid()
        )
    )
    WITH CHECK (
        message_type = 'gym_invite'
        AND (metadata->>'status') IN ('accepted', 'declined')
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
