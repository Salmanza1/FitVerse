-- Fix Supabase linter: Security Definer View on leaderboard_dorm_daily
-- Use security_invoker so RLS applies as the querying user (authenticated), not the view owner.

DROP VIEW IF EXISTS public.leaderboard_dorm_daily;

CREATE VIEW public.leaderboard_dorm_daily
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

COMMENT ON VIEW public.leaderboard_dorm_daily IS
    'Daily dorm XP leaderboard. security_invoker=true respects RLS on profiles and user_daily_points.';

-- Invoker mode: callers need SELECT on underlying tables (RLS still applies)
GRANT SELECT ON public.user_daily_points TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.leaderboard_dorm_daily TO authenticated;
