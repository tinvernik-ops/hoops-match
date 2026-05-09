
-- Extra optional profile fields
ALTER TABLE public.profiles
  ADD COLUMN vertical_cm INTEGER,
  ADD COLUMN weight_kg INTEGER;

-- Leagues
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  join_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.league_members (
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

-- Helper to check membership without recursive RLS
CREATE OR REPLACE FUNCTION public.is_league_member(_league_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = _league_id AND user_id = _user_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_league_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_league_member(UUID, UUID) TO authenticated;

-- Games
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  team_a_score INTEGER NOT NULL DEFAULT 0 CHECK (team_a_score >= 0),
  team_b_score INTEGER NOT NULL DEFAULT 0 CHECK (team_b_score >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE public.team_side AS ENUM ('A', 'B');

CREATE TABLE public.game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team public.team_side NOT NULL,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  rebounds INTEGER NOT NULL DEFAULT 0 CHECK (rebounds >= 0),
  assists INTEGER NOT NULL DEFAULT 0 CHECK (assists >= 0),
  steals INTEGER NOT NULL DEFAULT 0 CHECK (steals >= 0),
  blocks INTEGER NOT NULL DEFAULT 0 CHECK (blocks >= 0),
  UNIQUE (game_id, user_id)
);

-- RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Leagues: any authed user can look up by join_code (needed before joining);
-- members can see, owner can update/delete, any authed user can create.
CREATE POLICY "Leagues viewable by authenticated"
  ON public.leagues FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create league"
  ON public.leagues FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner updates league"
  ON public.leagues FOR UPDATE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Owner deletes league"
  ON public.leagues FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- League members
CREATE POLICY "Members view membership rows of their leagues"
  ON public.league_members FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));

CREATE POLICY "User joins league as themselves"
  ON public.league_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User leaves league themselves"
  ON public.league_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Games
CREATE POLICY "Members view games"
  ON public.games FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));

CREATE POLICY "Members create games"
  ON public.games FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_league_member(league_id, auth.uid()));

CREATE POLICY "Author updates game"
  ON public.games FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Author deletes game"
  ON public.games FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Game players
CREATE POLICY "Members view game players"
  ON public.game_players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND public.is_league_member(g.league_id, auth.uid())));

CREATE POLICY "Game author manages players (insert)"
  ON public.game_players FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.created_by = auth.uid()));

CREATE POLICY "Game author manages players (update)"
  ON public.game_players FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.created_by = auth.uid()));

CREATE POLICY "Game author manages players (delete)"
  ON public.game_players FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.created_by = auth.uid()));

-- Auto-add owner as first member
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.league_members (league_id, user_id) VALUES (NEW.id, NEW.owner_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER leagues_add_owner_member
  AFTER INSERT ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_members;

CREATE INDEX idx_games_league ON public.games(league_id, played_at DESC);
CREATE INDEX idx_game_players_game ON public.game_players(game_id);
CREATE INDEX idx_game_players_user ON public.game_players(user_id);
