-- Fix infinite recursion in chat_participants RLS policies

CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.chat_participants
        WHERE chat_id = p_chat_id AND user_id = p_user_id
    );
$$;

DROP POLICY IF EXISTS "Members read participants" ON public.chat_participants;
CREATE POLICY "Members read participants" ON public.chat_participants
    FOR SELECT USING (public.is_chat_member(chat_id, auth.uid()));

DROP POLICY IF EXISTS "Members read chats" ON public.chats;
CREATE POLICY "Members read chats" ON public.chats
    FOR SELECT USING (public.is_chat_member(id, auth.uid()));

DROP POLICY IF EXISTS "Members read messages" ON public.messages;
CREATE POLICY "Members read messages" ON public.messages
    FOR SELECT USING (public.is_chat_member(chat_id, auth.uid()));

DROP POLICY IF EXISTS "Members send messages" ON public.messages;
CREATE POLICY "Members send messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND public.is_chat_member(chat_id, auth.uid())
    );
