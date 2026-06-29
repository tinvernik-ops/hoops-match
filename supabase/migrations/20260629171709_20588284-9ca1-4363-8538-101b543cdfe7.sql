
-- =========================================================
-- 1) Ratings: hide rater identity from non-participants
-- =========================================================
DROP POLICY IF EXISTS "Ratings viewable by authenticated users" ON public.ratings;

-- Allow participants (rater or ratee) to read their own rows in full
CREATE POLICY "Participants read own ratings"
ON public.ratings FOR SELECT TO authenticated
USING (auth.uid() = rater_id OR auth.uid() = ratee_id);

-- Allow any authenticated user to read aggregate score columns (no rater_id)
CREATE POLICY "Authenticated read rating scores"
ON public.ratings FOR SELECT TO authenticated
USING (true);

-- Column-level grants prevent rater_id leakage to non-participants.
REVOKE SELECT ON public.ratings FROM authenticated;
GRANT SELECT (id, ratee_id, offense, defense, created_at) ON public.ratings TO authenticated;
-- Participants need rater_id visibility for their own rows; handled via a definer helper if needed later.
GRANT INSERT (rater_id, ratee_id, offense, defense) ON public.ratings TO authenticated;
GRANT UPDATE (offense, defense) ON public.ratings TO authenticated;
GRANT DELETE ON public.ratings TO authenticated;

-- =========================================================
-- 2) Chat images: scope reads to conversation membership;
--    add UPDATE policy scoped to owner folder
-- =========================================================
DROP POLICY IF EXISTS "chat-images authenticated read" ON storage.objects;

CREATE POLICY "chat-images conversation read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.image_url = storage.objects.name
        AND (dm.sender_id = auth.uid() OR dm.recipient_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.league_messages lm
      JOIN public.league_members mem
        ON mem.league_id = lm.league_id AND mem.user_id = auth.uid()
      WHERE lm.image_url = storage.objects.name
    )
  )
);

CREATE POLICY "chat-images owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- =========================================================
-- 3) game_verifications: explicit INSERT policy for participants
-- =========================================================
CREATE POLICY "Participants insert own verification"
ON public.game_verifications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.game_id = game_verifications.game_id
      AND gp.user_id = auth.uid()
  )
);

-- =========================================================
-- 4) public_profiles view: invoker semantics + safe column exposure
-- =========================================================
-- Allow authenticated users to read all profile rows (column grants restrict which columns)
CREATE POLICY "Authenticated read public profile columns"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- Restrict sensitive columns: only the owner may read phone, weight, vertical, alert prefs.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, username, avatar_url, height_cm, lat, lng,
  playstyle, preferred_game_type, location_updated_at,
  created_at, updated_at
) ON public.profiles TO authenticated;

-- Owner-only sensitive columns are accessible through a definer RPC.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Recreate view with security_invoker so RLS + column grants apply per-caller
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT
  id, username, avatar_url, height_cm, lat, lng,
  playstyle, preferred_game_type, location_updated_at,
  created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- =========================================================
-- 5) Revoke EXECUTE on SECURITY DEFINER trigger functions
--    (triggers fire under table privileges, not user EXECUTE)
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_league_invite_accept() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_game_verification() FROM PUBLIC, anon, authenticated;
