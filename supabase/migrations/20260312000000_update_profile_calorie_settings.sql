-- Add weekly_goal_rate and enable_negative_adjustments to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_goal_rate TEXT DEFAULT 'lose_1_0_lb_per_week';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enable_negative_adjustments BOOLEAN DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN public.profiles.weekly_goal_rate IS 'Target weight change per week (enum: lose_0_5/1_0/1_5, maintain, gain_0_5/1_0)';
COMMENT ON COLUMN public.profiles.enable_negative_adjustments IS 'Whether to allow synced exercise calories to be negative';
