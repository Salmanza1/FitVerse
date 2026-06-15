-- Live workout presence for group chat status indicators
CREATE TABLE IF NOT EXISTS public.workout_live_status (
    user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('active', 'idle')),
    workout_name    TEXT,
    exercise_name   TEXT,
    sets_completed  INTEGER NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_live_status_status_idx
    ON public.workout_live_status (status)
    WHERE status = 'active';

ALTER TABLE public.workout_live_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read workout presence" ON public.workout_live_status;
CREATE POLICY "Users read workout presence"
    ON public.workout_live_status FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users upsert own workout presence" ON public.workout_live_status;
CREATE POLICY "Users upsert own workout presence"
    ON public.workout_live_status FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own workout presence" ON public.workout_live_status;
CREATE POLICY "Users update own workout presence"
    ON public.workout_live_status FOR UPDATE
    USING (auth.uid() = user_id);

-- Daily workout nudge limit (one nudge per friend per day)
CREATE TABLE IF NOT EXISTS public.workout_nudges (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chat_id         UUID REFERENCES public.chats(id) ON DELETE SET NULL,
    nudge_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sender_id, receiver_id, nudge_date)
);

CREATE INDEX IF NOT EXISTS workout_nudges_receiver_date_idx
    ON public.workout_nudges (receiver_id, nudge_date DESC);

ALTER TABLE public.workout_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own nudges" ON public.workout_nudges;
CREATE POLICY "Users read own nudges"
    ON public.workout_nudges FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users send nudges" ON public.workout_nudges;
CREATE POLICY "Users send nudges"
    ON public.workout_nudges FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Allow chat creators to add all members when bootstrapping a chat
CREATE OR REPLACE FUNCTION public.bootstrap_chat_members(p_chat_id UUID, p_user_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (auth.uid() = ANY (p_user_ids)) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.chats WHERE id = p_chat_id) THEN
        RAISE EXCEPTION 'Chat not found';
    END IF;

    INSERT INTO public.chat_participants (chat_id, user_id)
    SELECT p_chat_id, uid
    FROM unnest(p_user_ids) AS uid
    ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_chat_members(UUID, UUID[]) TO authenticated;

-- Realtime for live presence updates in group chats
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_live_status;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
