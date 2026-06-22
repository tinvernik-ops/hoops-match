CREATE TABLE public.shooting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  made boolean NOT NULL,
  court_x numeric NOT NULL,
  court_y numeric NOT NULL,
  form_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_score numeric,
  notes text,
  video_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shooting_sessions TO authenticated;
GRANT ALL ON public.shooting_sessions TO service_role;

ALTER TABLE public.shooting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own shooting sessions"
  ON public.shooting_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shooting sessions readable by all authenticated"
  ON public.shooting_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX shooting_sessions_user_idx ON public.shooting_sessions(user_id, created_at DESC);