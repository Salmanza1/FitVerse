-- ============================================================
-- FitVerse Database Cleanup (canonical schema + social/chat)
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS
-- Apply: Supabase Dashboard → SQL Editor, or `npx supabase db push`
-- ============================================================

-- ─── PROFILES: document & align columns with app (lib/mapping.ts) ─────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activity_level TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dorm TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_gym TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_workout_goal INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS protein_target INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS carb_target INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fat_target INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calorie_target INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_goal_rate TEXT DEFAULT 'lose_1_0_lb_per_week';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_split TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_coach_data JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enable_negative_adjustments BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_unit_lbs BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS distance_unit_mi BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_recaps BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS private_profile BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_username_change TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

COMMENT ON TABLE public.profiles IS 'Extended user profile; id matches auth.users.id';

-- ─── FRIENDSHIPS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    CHECK (requester_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_requester_receiver_idx
    ON public.friendships (requester_id, receiver_id);
CREATE INDEX IF NOT EXISTS friendships_receiver_status_idx
    ON public.friendships (receiver_id, status);
CREATE INDEX IF NOT EXISTS friendships_requester_status_idx
    ON public.friendships (requester_id, status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own friendships" ON public.friendships;
CREATE POLICY "Users read own friendships" ON public.friendships
    FOR SELECT USING (auth.uid() IN (requester_id, receiver_id));

DROP POLICY IF EXISTS "Users send friend requests" ON public.friendships;
CREATE POLICY "Users send friend requests" ON public.friendships
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users respond to friend requests" ON public.friendships;
CREATE POLICY "Users respond to friend requests" ON public.friendships
    FOR UPDATE USING (auth.uid() = receiver_id);

-- ─── CHAT ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chats (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type        TEXT NOT NULL CHECK (type IN ('direct', 'group')),
    name        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
    chat_id     UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id     UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_chat_id_created_at_idx
    ON public.messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_participants_user_id_idx
    ON public.chat_participants (user_id);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: user is a member of a chat
DROP POLICY IF EXISTS "Members read chats" ON public.chats;
CREATE POLICY "Members read chats" ON public.chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants cp
            WHERE cp.chat_id = id AND cp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users create chats" ON public.chats;
CREATE POLICY "Authenticated users create chats" ON public.chats
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Members read participants" ON public.chat_participants;
CREATE POLICY "Members read participants" ON public.chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants cp
            WHERE cp.chat_id = chat_participants.chat_id AND cp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users join chats" ON public.chat_participants;
CREATE POLICY "Users join chats" ON public.chat_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members read messages" ON public.messages;
CREATE POLICY "Members read messages" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants cp
            WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members send messages" ON public.messages;
CREATE POLICY "Members send messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.chat_participants cp
            WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid()
        )
    );

-- ─── LEADERBOARD: single system (daily points) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_daily_points (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    points          INTEGER NOT NULL DEFAULT 0,
    workout_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.dorm_medal_points (
    dorm        TEXT NOT NULL,
    gender      TEXT NOT NULL,
    points      INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (dorm, gender)
);

ALTER TABLE public.user_daily_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dorm_medal_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read daily points" ON public.user_daily_points;
CREATE POLICY "Anyone can read daily points" ON public.user_daily_points
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage own daily points" ON public.user_daily_points;
CREATE POLICY "Users can manage own daily points" ON public.user_daily_points
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read medal points" ON public.dorm_medal_points;
CREATE POLICY "Anyone can read medal points" ON public.dorm_medal_points
    FOR SELECT USING (auth.role() = 'authenticated');

-- Canonical daily leaderboard view (used by app; security_invoker for Supabase linter)
CREATE OR REPLACE VIEW public.leaderboard_dorm_daily
WITH (security_invoker = true)
AS
WITH daily_raw AS (
    SELECT
        COALESCE(NULLIF(p.dorm, ''), 'Unknown') AS dorm,
        p.gender,
        SUM(udp.points) AS total_xp
    FROM public.user_daily_points udp
    JOIN public.profiles p ON udp.user_id = p.id
    WHERE udp.date = CURRENT_DATE
    GROUP BY p.dorm, p.gender

    UNION ALL

    SELECT
        COALESCE(NULLIF(p.dorm, ''), 'Unknown') AS dorm,
        'Mixed' AS gender,
        SUM(udp.points) AS total_xp
    FROM public.user_daily_points udp
    JOIN public.profiles p ON udp.user_id = p.id
    WHERE udp.date = CURRENT_DATE
    GROUP BY p.dorm
)
SELECT
    dorm,
    gender,
    total_xp,
    RANK() OVER (PARTITION BY gender ORDER BY total_xp DESC) AS rank
FROM daily_raw;

-- Workout → daily points trigger (canonical)
CREATE OR REPLACE FUNCTION public.grant_workout_points()
RETURNS TRIGGER AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.user_daily_points
        WHERE user_id = NEW.user_id AND date = (NEW.date)::DATE
    ) INTO v_exists;

    IF NOT v_exists THEN
        INSERT INTO public.user_daily_points (user_id, date, points, workout_count)
        VALUES (NEW.user_id, (NEW.date)::DATE, 100, 1);
    ELSE
        UPDATE public.user_daily_points
        SET workout_count = workout_count + 1,
            updated_at = now()
        WHERE user_id = NEW.user_id AND date = (NEW.date)::DATE;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workout_logged_grant_points ON public.workout_logs;
CREATE TRIGGER on_workout_logged_grant_points
    AFTER INSERT ON public.workout_logs
    FOR EACH ROW EXECUTE FUNCTION public.grant_workout_points();

-- Remove legacy weekly volume leaderboard views (app uses leaderboard_dorm_daily)
DROP VIEW IF EXISTS public.leaderboard_dorm_weekly;
DROP VIEW IF EXISTS public.leaderboard_user_xp;

-- ─── GRANTS ──────────────────────────────────────────────────────────────────
GRANT SELECT ON public.leaderboard_dorm_daily TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT SELECT, INSERT ON public.chats TO authenticated;
GRANT SELECT, INSERT ON public.chat_participants TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
