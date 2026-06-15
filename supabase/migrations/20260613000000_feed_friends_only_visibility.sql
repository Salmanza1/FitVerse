-- Friends-only posts: visible to author + accepted friends (not the whole app).

DROP POLICY IF EXISTS "Friends can read private posts" ON public.posts;
CREATE POLICY "Friends can read private posts" ON public.posts
    FOR SELECT USING (
        auth.role() = 'authenticated'
        AND is_public = false
        AND (
            user_id = auth.uid()
            OR public.are_friends(auth.uid(), user_id)
        )
    );

-- New posts default to friends-only unless the user opts into Community.
ALTER TABLE public.posts ALTER COLUMN is_public SET DEFAULT false;
