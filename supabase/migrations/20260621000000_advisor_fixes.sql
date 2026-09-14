-- ============================================================
-- Supabase Advisor fixes + signup-scale hardening
-- Safe to re-run: OR REPLACE / DROP IF EXISTS / IF NOT EXISTS
-- Apply: Supabase Dashboard → SQL Editor, or `npx supabase db push`
-- ============================================================
-- Covers:
--   SECURITY  → function_search_path_mutable (3 functions)
--   SECURITY  → profiles readable by anon (privacy); add missing INSERT policy
--   PERF      → unindexed_foreign_keys (7 columns)
--   PERF      → duplicate_index (comments/likes post_id)
--   PERF      → multiple_permissive_policies (user_daily_points SELECT)
-- ============================================================


-- ─── 1. function_search_path_mutable ─────────────────────────────────────────
-- Pin search_path on SECURITY DEFINER trigger functions. Bodies already
-- schema-qualify every table, so search_path = '' is safe.

CREATE OR REPLACE FUNCTION public.grant_workout_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.process_daily_medals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.dorm_medal_points (dorm, gender, points)
    SELECT dorm, gender,
           CASE WHEN rank = 1 THEN 3 WHEN rank = 2 THEN 2 WHEN rank = 3 THEN 1 ELSE 0 END
    FROM public.leaderboard_dorm_daily
    WHERE rank <= 3
    ON CONFLICT (dorm, gender) DO UPDATE
    SET points = public.dorm_medal_points.points + EXCLUDED.points,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_dorm_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
        AND OLD.dorm IS NOT NULL
        AND TRIM(OLD.dorm::text) <> ''
        AND NEW.dorm IS DISTINCT FROM OLD.dorm
    THEN
        RAISE EXCEPTION 'Dorm cannot be changed after account creation';
    END IF;
    RETURN NEW;
END;
$$;

-- ─── 2. profiles: stop exposing every profile to anon; allow self-insert ──────
-- Was: FOR SELECT USING (true)  → anyone with the public anon key could read
-- every profile row (email, phone, dorm, dob, weight). Restrict to logged-in
-- users. Username/email login still works via the SECURITY DEFINER RPCs
-- (get_email_for_username, check_username_available), which bypass RLS.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- The signup trigger (SECURITY DEFINER) normally creates the row, but the
-- client self-healing path in fetchUserProfile does an upsert — without an
-- INSERT policy that upsert is silently blocked by RLS.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);

-- ─── 3. unindexed_foreign_keys ───────────────────────────────────────────────
-- Add a covering index for every FK column that isn't already the leftmost
-- column of an existing index. Speeds up joins and cascade deletes under load.
CREATE INDEX IF NOT EXISTS comments_user_id_idx           ON public.comments(user_id);

CREATE INDEX IF NOT EXISTS likes_user_id_idx              ON public.likes(user_id);

CREATE INDEX IF NOT EXISTS workout_templates_user_id_idx  ON public.workout_templates(user_id);

CREATE INDEX IF NOT EXISTS messages_sender_id_idx         ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS message_reactions_user_id_idx  ON public.message_reactions(user_id);

CREATE INDEX IF NOT EXISTS chat_invites_inviter_id_idx    ON public.chat_invites(inviter_id);

CREATE INDEX IF NOT EXISTS workout_nudges_chat_id_idx     ON public.workout_nudges(chat_id);

-- ─── 4. duplicate_index ──────────────────────────────────────────────────────
-- social_feed_integrity created second copies of post_id indexes that already
-- exist from the core tables migration. Drop the redundant ones.
DROP INDEX IF EXISTS public.idx_comments_post_id;

-- dup of comments_post_id_idx
DROP INDEX IF EXISTS public.idx_likes_post_id;

-- dup of likes_post_id_idx


-- ─── 5. multiple_permissive_policies (user_daily_points) ──────────────────────
-- "Anyone can read daily points" (SELECT) + "Users can manage own daily points"
-- (FOR ALL) gave two permissive SELECT policies for authenticated. Split the
-- FOR ALL into write-only policies so SELECT has a single policy.
DROP POLICY IF EXISTS "Users can manage own daily points" ON public.user_daily_points;

DROP POLICY IF EXISTS "Users insert own daily points" ON public.user_daily_points;

CREATE POLICY "Users insert own daily points" ON public.user_daily_points
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own daily points" ON public.user_daily_points;

CREATE POLICY "Users update own daily points" ON public.user_daily_points
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own daily points" ON public.user_daily_points;

CREATE POLICY "Users delete own daily points" ON public.user_daily_points
    FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
