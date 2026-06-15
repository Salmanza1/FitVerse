-- Allow both parties to update a friendship row (accept/decline/resend after decline)
DROP POLICY IF EXISTS "Users respond to friend requests" ON public.friendships;
CREATE POLICY "Users respond to friend requests" ON public.friendships
    FOR UPDATE USING (auth.uid() IN (requester_id, receiver_id));
