-- Enable Row Level Security and add policies so users can manage their own poll_votes
-- This assumes your auth JWT includes a 'username' claim matching the poll_votes.username column.

-- Enable RLS on poll_votes
ALTER TABLE IF EXISTS public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to SELECT poll_votes (so polls can display vote counts)
CREATE POLICY allow_select_poll_votes ON public.poll_votes FOR SELECT USING (true);

-- Allow authenticated users to INSERT poll_votes but only for themselves
CREATE POLICY allow_insert_poll_votes_for_owner ON public.poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'username') IS NOT NULL AND username = (auth.jwt() ->> 'username'));

-- Allow authenticated users to UPDATE their own poll_votes
CREATE POLICY allow_update_poll_votes_for_owner ON public.poll_votes
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'username') IS NOT NULL AND username = (auth.jwt() ->> 'username'))
  WITH CHECK ((auth.jwt() ->> 'username') IS NOT NULL AND username = (auth.jwt() ->> 'username'));

-- Allow authenticated users to DELETE their own poll_votes
CREATE POLICY allow_delete_poll_votes_for_owner ON public.poll_votes
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'username') IS NOT NULL AND username = (auth.jwt() ->> 'username'));

-- Note: If your client is using the anon/public key without user JWTs containing 'username',
-- these policies will block writes. In that case either
-- 1) update your auth to include a 'username' claim in the JWT, or
-- 2) relax the policies to rely on auth.uid() or another identifier, or
-- 3) run server-side functions with the service_role key.
