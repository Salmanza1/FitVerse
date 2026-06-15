-- Admin user directory (owner / SQL Editor only — NOT exposed to the mobile app API)
--
-- Passwords CANNOT be viewed: Supabase Auth stores one-way hashes in auth.users.
-- To reset a user's password: Dashboard → Authentication → Users → select user → Send password recovery
-- or use the Admin API with your service_role key (never put that key in the app).

CREATE SCHEMA IF NOT EXISTS private;

COMMENT ON SCHEMA private IS
    'Internal admin objects. Not in API exposed schemas. Query via SQL Editor as project owner.';

CREATE OR REPLACE VIEW private.user_directory AS
SELECT
    p.id AS user_id,
    p.display_name,
    p.name AS full_name,
    p.email AS profile_email,
    u.email AS auth_email,
    p.dorm,
    p.phone,
    u.created_at AS signed_up_at,
    u.last_sign_in_at,
    u.confirmed_at AS email_confirmed_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.display_name;

COMMENT ON VIEW private.user_directory IS
    'Links profile display names to auth emails. Passwords are not stored and cannot be listed.';

-- Block app roles; only dashboard / service_role / postgres can use this
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon, authenticated;

GRANT USAGE ON SCHEMA private TO postgres, service_role;
GRANT SELECT ON private.user_directory TO postgres, service_role;
