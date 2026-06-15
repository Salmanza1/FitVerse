-- ============================================================
-- FitVerse Core Tables Migration
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- ─── PROFILES: ensure gender column exists ────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;

-- ─── POSTS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('workout', 'photo', 'status')),
    description TEXT NOT NULL DEFAULT '',
    image_url   TEXT,                         -- Supabase Storage URL or base64 data URI
    is_public   BOOLEAN NOT NULL DEFAULT true,
    -- Workout-specific summary (denormalized for fast feed queries)
    workout_id          TEXT,
    workout_title       TEXT,
    workout_duration    INTEGER,             -- seconds
    workout_exercises   INTEGER,
    workout_volume      NUMERIC,
    muscle_intensities  JSONB,               -- e.g. {"chest": 0.8, "triceps": 0.4}
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read public posts
DO $$ BEGIN
    DROP POLICY IF EXISTS "Anyone can read public posts" ON public.posts;
    CREATE POLICY "Anyone can read public posts" ON public.posts
        FOR SELECT USING (auth.role() = 'authenticated' AND is_public = true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Users can insert their own posts
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
    CREATE POLICY "Users can insert own posts" ON public.posts
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Users can update their own posts
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
    CREATE POLICY "Users can update own posts" ON public.posts
        FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Users can delete their own posts
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
    CREATE POLICY "Users can delete own posts" ON public.posts
        FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Index for fast feed queries
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts(created_at DESC);

-- ─── COMMENTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Anyone authenticated can read comments" ON public.comments;
    CREATE POLICY "Anyone authenticated can read comments" ON public.comments
        FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can insert own comments" ON public.comments;
    CREATE POLICY "Users can insert own comments" ON public.comments
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
    CREATE POLICY "Users can delete own comments" ON public.comments
        FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS comments_post_id_idx ON public.comments(post_id);

-- ─── LIKES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.likes (
    post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (post_id, user_id)           -- prevents duplicate likes
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Anyone authenticated can read likes" ON public.likes;
    CREATE POLICY "Anyone authenticated can read likes" ON public.likes
        FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can like posts" ON public.likes;
    CREATE POLICY "Users can like posts" ON public.likes
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can unlike posts" ON public.likes;
    CREATE POLICY "Users can unlike posts" ON public.likes
        FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS likes_post_id_idx ON public.likes(post_id);

-- ─── WORKOUT LOGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_logs (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    duration        INTEGER NOT NULL DEFAULT 0,  -- seconds
    notes           TEXT,
    exercises       JSONB NOT NULL DEFAULT '[]', -- Full Exercise[] blob
    total_volume    NUMERIC DEFAULT 0,
    muscle_intensities JSONB,
    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read workout_logs
-- (leaderboard view needs cross-user reads; individual privacy is handled at the app layer)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated users can read workout_logs" ON public.workout_logs;
    CREATE POLICY "Authenticated users can read workout_logs" ON public.workout_logs
        FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workout_logs;
    CREATE POLICY "Users can insert own workouts" ON public.workout_logs
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update own workouts" ON public.workout_logs;
    CREATE POLICY "Users can update own workouts" ON public.workout_logs
        FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workout_logs;
    CREATE POLICY "Users can delete own workouts" ON public.workout_logs
        FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS workout_logs_user_id_idx ON public.workout_logs(user_id);
CREATE INDEX IF NOT EXISTS workout_logs_date_idx ON public.workout_logs(date DESC);

-- ─── WORKOUT TEMPLATES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_templates (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    exercises   JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can read own templates" ON public.workout_templates;
    CREATE POLICY "Users can read own templates" ON public.workout_templates
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can insert own templates" ON public.workout_templates;
    CREATE POLICY "Users can insert own templates" ON public.workout_templates
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can delete own templates" ON public.workout_templates;
    CREATE POLICY "Users can delete own templates" ON public.workout_templates
        FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─── NUTRITION LOGS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    log_data    JSONB NOT NULL DEFAULT '{}',  -- Full DailyLog object
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (user_id, date)  -- one log per user per day
);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can read own nutrition logs" ON public.nutrition_logs;
    CREATE POLICY "Users can read own nutrition logs" ON public.nutrition_logs
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can insert own nutrition logs" ON public.nutrition_logs;
    CREATE POLICY "Users can insert own nutrition logs" ON public.nutrition_logs
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update own nutrition logs" ON public.nutrition_logs;
    CREATE POLICY "Users can update own nutrition logs" ON public.nutrition_logs
        FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can delete own nutrition logs" ON public.nutrition_logs;
    CREATE POLICY "Users can delete own nutrition logs" ON public.nutrition_logs
        FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS nutrition_logs_user_date_idx ON public.nutrition_logs(user_id, date DESC);

-- ─── LEADERBOARD VIEW (XP by Dorm) ───────────────────────────────────────────
-- XP formula: each workout = 50 base XP + (total_volume / 100) + (duration / 60)
-- This runs on the current week's data
CREATE OR REPLACE VIEW public.leaderboard_dorm_weekly AS
SELECT
    p.dorm,
    p.gender,
    SUM(
        50 +
        COALESCE(w.total_volume, 0) / 100 +
        COALESCE(w.duration, 0) / 60
    )::INTEGER AS total_xp,
    COUNT(DISTINCT w.user_id) AS participant_count,
    COUNT(w.id) AS workout_count
FROM
    public.workout_logs w
    JOIN public.profiles p ON w.user_id = p.id
WHERE
    w.date >= date_trunc('week', CURRENT_DATE)
    AND w.date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
GROUP BY
    p.dorm, p.gender
ORDER BY
    total_xp DESC;

-- Individual user XP view (all time + weekly)
CREATE OR REPLACE VIEW public.leaderboard_user_xp AS
SELECT
    p.id AS user_id,
    p.display_name,
    p.dorm,
    p.gender,
    -- Weekly XP
    COALESCE(SUM(
        CASE
            WHEN w.date >= date_trunc('week', CURRENT_DATE) THEN
                50 + COALESCE(w.total_volume, 0) / 100 + COALESCE(w.duration, 0) / 60
            ELSE 0
        END
    ), 0)::INTEGER AS weekly_xp,
    -- All-time XP
    COALESCE(SUM(
        50 + COALESCE(w.total_volume, 0) / 100 + COALESCE(w.duration, 0) / 60
    ), 0)::INTEGER AS total_xp,
    COUNT(w.id) AS total_workouts
FROM
    public.profiles p
    LEFT JOIN public.workout_logs w ON p.id = w.user_id
GROUP BY
    p.id, p.display_name, p.dorm, p.gender
ORDER BY
    weekly_xp DESC;
