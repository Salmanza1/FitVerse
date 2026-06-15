-- ============================================================
-- Daily Leaderboard & Point System Migration
-- ============================================================

-- 1. Create a table to track daily workout completion (CAP at 1 workout/day for 100XP, then 10XP)
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

-- 2. Create a table to track "Gold Medal" points (3, 2, 1 for top dorms)
CREATE TABLE IF NOT EXISTS public.dorm_medal_points (
    dorm        TEXT NOT NULL,
    gender      TEXT NOT NULL, -- 'Male' | 'Female' | 'Mixed'
    points      INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (dorm, gender)
);

-- 3. Function to calculate and grant points when a workout is saved
CREATE OR REPLACE FUNCTION public.grant_workout_points()
RETURNS TRIGGER AS $$
DECLARE
    v_points INTEGER;
    v_exists BOOLEAN;
BEGIN
    -- Check if user already worked out today
    SELECT EXISTS(SELECT 1 FROM public.user_daily_points WHERE user_id = NEW.user_id AND date = NEW.date) INTO v_exists;

    IF NOT v_exists THEN
        -- First workout of the day: 100 points
        INSERT INTO public.user_daily_points (user_id, date, points, workout_count)
        VALUES (NEW.user_id, NEW.date, 100, 1);
    ELSE
        -- Subsequent workouts: 0 points (points already capped at 100)
        UPDATE public.user_daily_points
        SET workout_count = workout_count + 1,
            updated_at = now()
        WHERE user_id = NEW.user_id AND date = NEW.date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for granting points
DROP TRIGGER IF EXISTS on_workout_logged_grant_points ON public.workout_logs;
CREATE TRIGGER on_workout_logged_grant_points
    AFTER INSERT ON public.workout_logs
    FOR EACH ROW EXECUTE FUNCTION public.grant_workout_points();

-- 5. Daily View: Current standings for Today's XP
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

-- 6. Medal Calculation Function (to be called at midnight or simulated)
-- In a real app, this would be a CRON job via pg_cron or an external ticker.
CREATE OR REPLACE FUNCTION public.process_daily_medals()
RETURNS void AS $$
BEGIN
    -- Add 3 points to #1, 2 to #2, 1 to #3 for each gender category
    INSERT INTO public.dorm_medal_points (dorm, gender, points)
    SELECT dorm, gender, 
           CASE WHEN rank = 1 THEN 3 WHEN rank = 2 THEN 2 WHEN rank = 3 THEN 1 ELSE 0 END as daily_points
    FROM public.leaderboard_dorm_daily
    WHERE rank <= 3
    ON CONFLICT (dorm, gender) DO UPDATE
    SET points = dorm_medal_points.points + EXCLUDED.points,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
