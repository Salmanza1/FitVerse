ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_split TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_coach_data JSONB;
