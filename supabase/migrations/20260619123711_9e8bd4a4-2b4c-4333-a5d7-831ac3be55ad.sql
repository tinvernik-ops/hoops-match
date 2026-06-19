
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS court_alert_threshold int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS court_alert_radius_km numeric NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dm_select_own" ON public.direct_messages;
CREATE POLICY "dm_select_own" ON public.direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "dm_insert_as_sender" ON public.direct_messages;
CREATE POLICY "dm_insert_as_sender" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "dm_update_recipient_read" ON public.direct_messages;
CREATE POLICY "dm_update_recipient_read" ON public.direct_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
CREATE INDEX IF NOT EXISTS direct_messages_pair_idx
  ON public.direct_messages (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);

CREATE TABLE IF NOT EXISTS public.league_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.league_messages TO authenticated;
GRANT ALL ON public.league_messages TO service_role;
ALTER TABLE public.league_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lm_select_members" ON public.league_messages;
CREATE POLICY "lm_select_members" ON public.league_messages FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));
DROP POLICY IF EXISTS "lm_insert_members" ON public.league_messages;
CREATE POLICY "lm_insert_members" ON public.league_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_league_member(league_id, auth.uid()));
DROP POLICY IF EXISTS "lm_delete_own_or_owner" ON public.league_messages;
CREATE POLICY "lm_delete_own_or_owner" ON public.league_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_league_owner(league_id, auth.uid()));
CREATE INDEX IF NOT EXISTS league_messages_league_idx ON public.league_messages (league_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.court_alert_state (
  court_id uuid PRIMARY KEY REFERENCES public.courts(id) ON DELETE CASCADE,
  last_player_count int NOT NULL DEFAULT 0,
  last_alert_at timestamptz
);
GRANT SELECT ON public.court_alert_state TO authenticated;
GRANT ALL ON public.court_alert_state TO service_role;
ALTER TABLE public.court_alert_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cas_select_auth" ON public.court_alert_state;
CREATE POLICY "cas_select_auth" ON public.court_alert_state FOR SELECT TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_messages;

DROP POLICY IF EXISTS "avatars_owner_read" ON storage.objects;
CREATE POLICY "avatars_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_owner_write" ON storage.objects;
CREATE POLICY "avatars_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
