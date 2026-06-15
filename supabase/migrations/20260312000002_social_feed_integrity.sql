-- Ensure Social Feed tables are correctly set up and optimized
-- This script fixes any potentially broken relationships or missing indices for the Feed

-- 1. Ensure foreign key constraints are robust
ALTER TABLE public.posts 
    DROP CONSTRAINT IF EXISTS posts_user_id_fkey,
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.comments 
    DROP CONSTRAINT IF EXISTS comments_post_id_fkey,
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS comments_user_id_fkey,
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.likes 
    DROP CONSTRAINT IF EXISTS likes_post_id_fkey,
    ADD CONSTRAINT likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE,
    DROP CONSTRAINT IF EXISTS likes_user_id_fkey,
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Index for performance (important as feed grows)
CREATE INDEX IF NOT EXISTS idx_posts_is_public_created_at ON public.posts(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);

-- 3. Grant proper permissions just in case
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
