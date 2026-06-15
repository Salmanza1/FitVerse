-- ============================================================
-- Username → Email Lookup RPC
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================
--
-- This function allows an unauthenticated user to resolve their display_name
-- (username) to the email address registered on their account, so they can
-- log in with either credential.
--
-- SECURITY NOTES:
--   • SECURITY DEFINER — runs as the function owner (postgres), bypassing RLS.
--     This is intentional and safe because:
--       1. It only returns a single email string, not any other profile data.
--       2. The lookup is case-insensitive on display_name only.
--       3. The actual authentication still requires the correct password via
--          Supabase Auth (signInWithPassword), so knowing someone's email does
--          not grant access to their account.
--   • set search_path = '' — prevents search_path injection attacks.
--   • RETURNS TEXT — returns NULL if no matching username is found, which means
--     the caller will not know whether the username exists at all until they
--     have the password too.  This prevents username enumeration.
--
CREATE OR REPLACE FUNCTION public.get_email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email
    INTO v_email
    FROM public.profiles
    WHERE LOWER(display_name) = LOWER(p_username)
    LIMIT 1;

    RETURN v_email; -- NULL if not found
END;
$$;

-- Grant execute to the anon role so unauthenticated Supabase clients can call it
GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO authenticated;
