-- ============================================================
-- Fix Leaderboard View & Trigger
-- ============================================================

-- Ensure the daily points table and trigger are correctly set up
-- (This effectively re-runs parts of the failed migration if it didn't fully commit)

CREATE TABLE IF NOT EXISTS public.user_daily_points (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    points      INTEGER NOT NULL DEFAULT 0,
    workout_count INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, date)
);

-- Fix the logic to grant points
CREATE OR REPLACE FUNCTION public.grant_workout_points()
RETURNS TRIGGER AS $$
DECLARE
    v_points INTEGER;
    v_exists BOOLEAN;
BEGIN
    -- Check if user already worked out today
    -- We use standard DATE comparison
    SELECT EXISTS(SELECT 1 FROM public.user_daily_points WHERE user_id = NEW.user_id AND date = NEW.date) INTO v_exists;

    IF NOT v_exists THEN
        -- First workout of the day: 100 points
        INSERT INTO public.user_daily_points (user_id, date, points, workout_count)
        VALUES (NEW.user_id, NEW.date, 100, 1);
    ELSE
        -- Subsequent workouts: update count
        UPDATE public.user_daily_points
        SET workout_count = workout_count + 1,
            updated_at = now()
        WHERE user_id = NEW.user_id AND date = NEW.date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS on_workout_logged_grant_points ON public.workout_logs;
CREATE TRIGGER on_workout_logged_grant_points
    AFTER INSERT ON public.workout_logs
    FOR EACH ROW EXECUTE FUNCTION public.grant_workout_points();

-- Daily View: Current standings with 'Mixed' tab
CREATE OR REPLACE VIEW public.leaderboard_dorm_daily AS
WITH daily_raw AS (
    -- Individual Gender Stats
    SELECT
        p.dorm,
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
        p.dorm,
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
