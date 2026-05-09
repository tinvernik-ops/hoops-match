
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  height_cm INTEGER,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Ratings (rater rates ratee on offense + defense 0..99)
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  offense INTEGER NOT NULL CHECK (offense BETWEEN 0 AND 99),
  defense INTEGER NOT NULL CHECK (defense BETWEEN 0 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rater_id, ratee_id),
  CHECK (rater_id <> ratee_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings viewable by authenticated users"
  ON public.ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own ratings"
  ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users update own ratings"
  ON public.ratings FOR UPDATE TO authenticated USING (auth.uid() = rater_id);

CREATE POLICY "Users delete own ratings"
  ON public.ratings FOR DELETE TO authenticated USING (auth.uid() = rater_id);

-- Hoop sesh invites
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status public.invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_id <> to_id)
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invites viewable by participants"
  ON public.invites FOR SELECT TO authenticated
  USING (auth.uid() = from_id OR auth.uid() = to_id);

CREATE POLICY "Users send invites as themselves"
  ON public.invites FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_id);

CREATE POLICY "Participants can update invite status"
  ON public.invites FOR UPDATE TO authenticated
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime for invites so the recipient sees them instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.invites;
