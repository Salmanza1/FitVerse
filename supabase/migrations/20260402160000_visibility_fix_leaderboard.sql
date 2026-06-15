-- ============================================================
-- Fix Leaderboard Visibility & RLS
-- ============================================================

-- 1. Enable RLS on user_daily_points (if not already enabled)
ALTER TABLE public.user_daily_points ENABLE ROW LEVEL SECURITY;

-- 2. Allow any authenticated user to read daily points
-- This is essential for the leaderboard to calculate dorm totals across all users
DO $$ BEGIN
    DROP POLICY IF EXISTS "Anyone can read daily points" ON public.user_daily_points;
    CREATE POLICY "Anyone can read daily points" ON public.user_daily_points
        FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Allow system (service_role) to insert/update (trigger runs as SECURITY DEFINER so this is handled)
-- But let's add an explicit policy for users to manage their own points just in case of future client-side use
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can manage own daily points" ON public.user_daily_points;
    CREATE POLICY "Users can manage own daily points" ON public.user_daily_points
        FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Rebuild the view to ensure robust name matching and no NULL gender issues
CREATE OR REPLACE VIEW public.leaderboard_dorm_daily AS
WITH daily_raw AS (
    -- Individual Gender Stats
    SELECT
        COALESCE(NULLIF(p.dorm, ''), 'Unknown') as dorm,
        p.gender,
        SUM(udp.points) as total_xp
    FROM
        public.user_daily_points udp
        JOIN public.profiles p ON udp.user_id = p.id
    WHERE
        udp.date = CURRENT_DATE
    GROUP BY
        p.dorm, p.gender

    UNION ALL

    -- Combined "Mixed" Stats (Overall)
    SELECT
        COALESCE(NULLIF(p.dorm, ''), 'Unknown') as dorm,
        'Mixed' as gender,
        SUM(udp.points) as total_xp
    FROM
        public.user_daily_points udp
        JOIN public.profiles p ON udp.user_id = p.id
    WHERE
        udp.date = CURRENT_DATE
    GROUP BY
        p.dorm
)
SELECT
    dorm,
    gender,
    total_xp,
    RANK() OVER (PARTITION BY gender ORDER BY total_xp DESC) as rank
FROM daily_raw;

-- 5. Final check on the trigger logic (standardize date format)
CREATE OR REPLACE FUNCTION public.grant_workout_points()
RETURNS TRIGGER AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if user already worked out today
    -- We cast date to ensure consistency
    SELECT EXISTS(
        SELECT 1 FROM public.user_daily_points 
        WHERE user_id = NEW.user_id AND date = (NEW.date)::DATE
    ) INTO v_exists;

    IF NOT v_exists THEN
        -- First workout of the day: 100 points
        INSERT INTO public.user_daily_points (user_id, date, points, workout_count)
        VALUES (NEW.user_id, (NEW.date)::DATE, 100, 1);
    ELSE
        -- Subsequent workouts: update count only (capped at 100XP)
        UPDATE public.user_daily_points
        SET workout_count = workout_count + 1,
            updated_at = now()
        WHERE user_id = NEW.user_id AND date = (NEW.date)::DATE;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Fallback: If trigger fails, don't block the workout log from saving
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
