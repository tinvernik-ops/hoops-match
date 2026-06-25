
-- 1. Internal schema for security-definer helpers
CREATE SCHEMA IF NOT EXISTS internal;
GRANT USAGE ON SCHEMA internal TO postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION internal.is_league_member(_league_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.league_members WHERE league_id = _league_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION internal.is_league_owner(_league_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.leagues WHERE id = _league_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION internal.is_assigned_avatar(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE avatar_url = _name);
$$;

-- 2. Recreate policies that reference public helpers
DROP POLICY IF EXISTS "Members view membership rows of their leagues" ON public.league_members;
CREATE POLICY "Members view membership rows of their leagues" ON public.league_members
  FOR SELECT TO authenticated USING (internal.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS "Members view games" ON public.games;
CREATE POLICY "Members view games" ON public.games
  FOR SELECT TO authenticated USING (internal.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS "Members create games" ON public.games;
CREATE POLICY "Members create games" ON public.games
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND internal.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS "Members view game players" ON public.game_players;
CREATE POLICY "Members view game players" ON public.game_players
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.games g
            WHERE g.id = game_players.game_id
              AND internal.is_league_member(g.league_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Owner or recipient view league invite" ON public.league_invites;
CREATE POLICY "Owner or recipient view league invite" ON public.league_invites
  FOR SELECT TO authenticated USING (
    auth.uid() = to_id OR auth.uid() = from_id OR internal.is_league_owner(league_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owner sends league invite" ON public.league_invites;
CREATE POLICY "Owner sends league invite" ON public.league_invites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_id AND internal.is_league_owner(league_id, auth.uid()));

DROP POLICY IF EXISTS "Owner deletes league invite" ON public.league_invites;
CREATE POLICY "Owner deletes league invite" ON public.league_invites
  FOR DELETE TO authenticated USING (internal.is_league_owner(league_id, auth.uid()));

DROP POLICY IF EXISTS "lm_select_members" ON public.league_messages;
CREATE POLICY "lm_select_members" ON public.league_messages
  FOR SELECT TO authenticated USING (internal.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS "lm_insert_members" ON public.league_messages;
CREATE POLICY "lm_insert_members" ON public.league_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND internal.is_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS "lm_delete_own_or_owner" ON public.league_messages;
CREATE POLICY "lm_delete_own_or_owner" ON public.league_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR internal.is_league_owner(league_id, auth.uid()));

-- 3. Drop public helper duplicates
DROP FUNCTION IF EXISTS public.is_league_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_league_owner(uuid, uuid);

-- 4. can_rate: switch to SECURITY INVOKER so it doesn't trip the SECURITY DEFINER lint
CREATE OR REPLACE FUNCTION public.can_rate(_rater uuid, _ratee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.game_players a
      JOIN public.game_players b ON a.game_id = b.game_id
      WHERE a.user_id = _rater AND b.user_id = _ratee
    )
    OR EXISTS (
      SELECT 1 FROM public.invites
      WHERE status = 'accepted'
        AND ((from_id = _rater AND to_id = _ratee) OR (from_id = _ratee AND to_id = _rater))
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_rate(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_rate(uuid, uuid) TO authenticated;

-- 5. Profiles: lock down to owner; create public_profiles view for safe cross-user reads
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT id, username, avatar_url, height_cm, lat, lng, playstyle, preferred_game_type, created_at, updated_at
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 6. Leagues: members, owner, and pending invitees only
DROP POLICY IF EXISTS "Leagues viewable by authenticated" ON public.leagues;
CREATE POLICY "Leagues viewable by members or invitees" ON public.leagues
  FOR SELECT TO authenticated USING (
    auth.uid() = owner_id
    OR internal.is_league_member(id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.league_invites li
      WHERE li.league_id = leagues.id AND li.to_id = auth.uid() AND li.status = 'pending'
    )
  );

-- 7. Shooting sessions: drop the over-permissive read policy
DROP POLICY IF EXISTS "Shooting sessions readable by all authenticated" ON public.shooting_sessions;

-- 8. Avatars: scope reads to own folder + currently-assigned avatars
DROP POLICY IF EXISTS "avatars_owner_read" ON storage.objects;
CREATE POLICY "avatars_read_own_or_assigned" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR internal.is_assigned_avatar(name)
    )
  );
