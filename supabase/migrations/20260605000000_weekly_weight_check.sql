-- Weekly weigh-in schedule + history for goal progress

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS weekly_weight_check_day TEXT DEFAULT 'sunday',
    ADD COLUMN IF NOT EXISTS weekly_weight_check_time TEXT DEFAULT '08:00',
    ADD COLUMN IF NOT EXISTS weight_check_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.profiles.weekly_weight_check_day IS 'Day of week for weekly weigh-in (sunday..saturday)';
COMMENT ON COLUMN public.profiles.weekly_weight_check_time IS 'Local time HH:mm for weekly weigh-in reminder';

CREATE TABLE IF NOT EXISTS public.weight_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    weight_kg NUMERIC NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT,
    source TEXT DEFAULT 'weekly_check'
);

CREATE INDEX IF NOT EXISTS weight_check_logs_user_logged_idx
    ON public.weight_check_logs (user_id, logged_at DESC);

ALTER TABLE public.weight_check_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own weight logs" ON public.weight_check_logs;
CREATE POLICY "Users read own weight logs" ON public.weight_check_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own weight logs" ON public.weight_check_logs;
CREATE POLICY "Users insert own weight logs" ON public.weight_check_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own weight logs" ON public.weight_check_logs;
CREATE POLICY "Users update own weight logs" ON public.weight_check_logs
    FOR UPDATE USING (auth.uid() = user_id);
