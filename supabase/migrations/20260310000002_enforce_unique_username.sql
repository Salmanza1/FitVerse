-- Enforce unique display names (usernames) so users cannot steal each other's identities
-- or lock out original users from username-based login.

-- First, deduplicate any existing display_names by appending unique IDs, so the UNIQUE constraint can be applied.
UPDATE public.profiles p1
SET display_name = p1.display_name || '_' || SUBSTRING(p1.id::text, 1, 4)
WHERE EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE LOWER(p1.display_name) = LOWER(p2.display_name)
    AND p1.id != p2.id
    AND p1.created_at > p2.created_at -- Keep the original one untouched, rename the duplicates
);

-- Then add a case-insensitive unique constraint if it doesn't already exist.
-- PostgreSQL allows creating a UNIQUE INDEX with LOWER() which acts as a constraint.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_lower_idx ON public.profiles (LOWER(display_name));

-- RPC function to allow unauthenticated checking if a username is available during signup
CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    is_taken BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE LOWER(display_name) = LOWER(p_username)
    ) INTO is_taken;
    
    RETURN NOT is_taken;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated;
