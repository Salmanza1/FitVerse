-- Dorm is chosen at signup and cannot be changed afterward.

CREATE OR REPLACE FUNCTION public.prevent_dorm_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
        AND OLD.dorm IS NOT NULL
        AND TRIM(OLD.dorm::text) <> ''
        AND NEW.dorm IS DISTINCT FROM OLD.dorm
    THEN
        RAISE EXCEPTION 'Dorm cannot be changed after account creation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_dorm_change ON public.profiles;

CREATE TRIGGER profiles_prevent_dorm_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_dorm_change();
