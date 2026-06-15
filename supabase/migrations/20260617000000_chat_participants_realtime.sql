-- Live member joins when invitees accept group chat invites.

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
