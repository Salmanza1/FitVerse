-- Saved / everyday foods — one-tap logging for items users eat regularly
CREATE TABLE IF NOT EXISTS public.saved_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_meal TEXT,
    food_data JSONB NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'serving',
    quantity NUMERIC NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_foods_user_sort_idx
    ON public.saved_foods(user_id, sort_order ASC, created_at ASC);

ALTER TABLE public.saved_foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own saved foods" ON public.saved_foods;

CREATE POLICY "Users read own saved foods" ON public.saved_foods
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own saved foods" ON public.saved_foods;

CREATE POLICY "Users insert own saved foods" ON public.saved_foods
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own saved foods" ON public.saved_foods;

CREATE POLICY "Users update own saved foods" ON public.saved_foods
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own saved foods" ON public.saved_foods;

CREATE POLICY "Users delete own saved foods" ON public.saved_foods
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE public.saved_foods IS 'User staples — tap to log the same meal every day without retyping';
