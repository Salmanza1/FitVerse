-- The daily leaderboard rolls over at campus midnight, not UTC midnight.
--
-- The view asked for `udp.date = CURRENT_DATE`, and CURRENT_DATE on this
-- database is UTC. Points are filed under the day the workout belongs to in
-- the user's own timezone, so from 8pm Eastern — when UTC has already moved on
-- — the view looked for tomorrow and the board came back empty.
--
-- It was wrong before that too, just less visibly: when workouts were dated in
-- UTC they matched, but that meant the day's standings silently reset at 8pm
-- local every evening, mid-workout for anyone training after dinner.
--
-- Notre Dame is Eastern, and the leaderboard is a campus competition, so the
-- day is pinned to that zone rather than read from each user. America/New_York
-- rather than a fixed offset, so this keeps working across daylight saving.

CREATE OR REPLACE VIEW public.leaderboard_dorm_daily AS
WITH daily_raw AS (
    SELECT
        COALESCE(NULLIF(p.dorm, ''::text), 'Unknown'::text) AS dorm,
        p.gender,
        sum(udp.points) AS total_xp
    FROM user_daily_points udp
        JOIN profiles p ON udp.user_id = p.id
    WHERE udp.date = (now() AT TIME ZONE 'America/New_York')::date
    GROUP BY p.dorm, p.gender

    UNION ALL

    SELECT
        COALESCE(NULLIF(p.dorm, ''::text), 'Unknown'::text) AS dorm,
        'Mixed'::text AS gender,
        sum(udp.points) AS total_xp
    FROM user_daily_points udp
        JOIN profiles p ON udp.user_id = p.id
    WHERE udp.date = (now() AT TIME ZONE 'America/New_York')::date
    GROUP BY p.dorm
)
SELECT
    dorm,
    gender,
    total_xp,
    rank() OVER (PARTITION BY gender ORDER BY total_xp DESC) AS rank
FROM daily_raw;
