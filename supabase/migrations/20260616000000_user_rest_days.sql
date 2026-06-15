-- Declared rest days: visible to friends in chat as purple status.

CREATE TABLE IF NOT EXISTS public.user_rest_days (
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rest_date   DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, rest_date)
);

CREATE INDEX IF NOT EXISTS user_rest_days_date_idx
    ON public.user_rest_days (rest_date);

ALTER TABLE public.user_rest_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rest days" ON public.user_rest_days;
CREATE POLICY "Anyone can read rest days" ON public.user_rest_days
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users manage own rest days" ON public.user_rest_days;
CREATE POLICY "Users manage own rest days" ON public.user_rest_days
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.user_rest_days TO authenticated;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_rest_days;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
