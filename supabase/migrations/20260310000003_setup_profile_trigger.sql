-- ============================================================
-- Profile Generation Trigger
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- This function automatically creates a row in the public.profiles table
-- whenever a new user signs up via Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User_' || SUBSTRING(NEW.id::text, 1, 5)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);
  RETURN NEW;
END;
$$;

-- Trigger the function every time a user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── RECOVERY: Create profiles for any orphaned users ────────────────────────
-- If you manually deleted profiles or the trigger wasn't running, this will
-- restore access for all existing auth users.
INSERT INTO public.profiles (id, email, display_name, name)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'display_name', 'User_' || SUBSTRING(id::text, 1, 5)),
    COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
