
-- Profiles: new visible fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS playstyle TEXT,
  ADD COLUMN IF NOT EXISTS preferred_game_type TEXT;

-- Uniqueness for username and phone (case-insensitive username)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_ci ON public.profiles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone);

-- Game type for league games
DO $$ BEGIN
  CREATE TYPE public.game_type AS ENUM ('1v1','2v2','3v3','4v4','5v5','koth');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS game_type public.game_type NOT NULL DEFAULT '5v5';

-- Shooting drills (private)
CREATE TABLE IF NOT EXISTS public.shooting_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  zone TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  makes INTEGER NOT NULL CHECK (makes >= 0 AND makes <= attempts),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shooting_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own drills" ON public.shooting_drills
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner inserts own drills" ON public.shooting_drills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own drills" ON public.shooting_drills
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner deletes own drills" ON public.shooting_drills
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS shooting_drills_user_idx ON public.shooting_drills (user_id, created_at DESC);
