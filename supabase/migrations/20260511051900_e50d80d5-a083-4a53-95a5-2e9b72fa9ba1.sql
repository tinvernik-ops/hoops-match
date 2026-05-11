-- Courts
CREATE TABLE public.courts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courts viewable by authenticated" ON public.courts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create courts" ON public.courts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator deletes court" ON public.courts FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- League invites
CREATE TYPE league_invite_status AS ENUM ('pending','accepted','declined');
CREATE TABLE public.league_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  from_id uuid NOT NULL,
  to_id uuid NOT NULL,
  status league_invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, to_id)
);
ALTER TABLE public.league_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_league_owner(_league_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.leagues WHERE id=_league_id AND owner_id=_user_id);
$$;

CREATE POLICY "Owner or recipient view league invite" ON public.league_invites FOR SELECT TO authenticated
  USING (auth.uid() = to_id OR auth.uid() = from_id OR public.is_league_owner(league_id, auth.uid()));
CREATE POLICY "Owner sends league invite" ON public.league_invites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_id AND public.is_league_owner(league_id, auth.uid()));
CREATE POLICY "Recipient updates league invite" ON public.league_invites FOR UPDATE TO authenticated
  USING (auth.uid() = to_id);
CREATE POLICY "Owner deletes league invite" ON public.league_invites FOR DELETE TO authenticated
  USING (public.is_league_owner(league_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_league_invite_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.league_members (league_id, user_id) VALUES (NEW.league_id, NEW.to_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_league_invite_accept AFTER UPDATE ON public.league_invites
  FOR EACH ROW EXECUTE FUNCTION public.handle_league_invite_accept();

-- Rating eligibility
CREATE OR REPLACE FUNCTION public.can_rate(_rater uuid, _ratee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
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

DROP POLICY IF EXISTS "Users insert own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users update own ratings" ON public.ratings;
CREATE POLICY "Users insert own ratings" ON public.ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rater_id AND auth.uid() <> ratee_id AND public.can_rate(auth.uid(), ratee_id));
CREATE POLICY "Users update own ratings" ON public.ratings FOR UPDATE TO authenticated
  USING (auth.uid() = rater_id) WITH CHECK (public.can_rate(auth.uid(), ratee_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courts;