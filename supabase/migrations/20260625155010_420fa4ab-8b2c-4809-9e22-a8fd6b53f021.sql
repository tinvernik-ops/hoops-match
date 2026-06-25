
-- Game verifications: each player (excluding the creator) is asked to verify the score (required) and stats (optional).
CREATE TYPE public.verify_status AS ENUM ('pending', 'approved', 'disputed');
CREATE TYPE public.stats_verify_status AS ENUM ('pending', 'approved', 'disputed', 'skipped');

CREATE TABLE public.game_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_status public.verify_status NOT NULL DEFAULT 'pending',
  stats_status public.stats_verify_status NOT NULL DEFAULT 'pending',
  dispute_note text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_verifications TO authenticated;
GRANT ALL ON public.game_verifications TO service_role;

ALTER TABLE public.game_verifications ENABLE ROW LEVEL SECURITY;

-- Players in the game (and the league members) can see verifications for that game
CREATE POLICY "Game players view verifications"
  ON public.game_verifications FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_verifications.game_id
        AND internal.is_league_member(g.league_id, auth.uid())
    )
  );

-- Only the verification owner can update their own row (approve/dispute)
CREATE POLICY "Owner updates own verification"
  ON public.game_verifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inserts/deletes happen via trigger (security definer); no direct client inserts/deletes
CREATE TRIGGER trg_game_verifications_updated_at
  BEFORE UPDATE ON public.game_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: when a game_player is inserted, create a pending verification row.
-- Auto-approve for the game's creator (they logged it).
CREATE OR REPLACE FUNCTION public.create_game_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_by uuid;
BEGIN
  SELECT created_by INTO v_created_by FROM public.games WHERE id = NEW.game_id;

  INSERT INTO public.game_verifications (game_id, user_id, score_status, stats_status, responded_at)
  VALUES (
    NEW.game_id,
    NEW.user_id,
    CASE WHEN NEW.user_id = v_created_by THEN 'approved'::public.verify_status ELSE 'pending'::public.verify_status END,
    CASE WHEN NEW.user_id = v_created_by THEN 'approved'::public.stats_verify_status ELSE 'pending'::public.stats_verify_status END,
    CASE WHEN NEW.user_id = v_created_by THEN now() ELSE NULL END
  )
  ON CONFLICT (game_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_game_verification() FROM anon, authenticated;

CREATE TRIGGER trg_game_players_create_verification
  AFTER INSERT ON public.game_players
  FOR EACH ROW EXECUTE FUNCTION public.create_game_verification();

-- Backfill verifications for existing games
INSERT INTO public.game_verifications (game_id, user_id, score_status, stats_status, responded_at)
SELECT
  gp.game_id,
  gp.user_id,
  CASE WHEN gp.user_id = g.created_by THEN 'approved'::public.verify_status ELSE 'approved'::public.verify_status END,
  CASE WHEN gp.user_id = g.created_by THEN 'approved'::public.stats_verify_status ELSE 'approved'::public.stats_verify_status END,
  now()
FROM public.game_players gp
JOIN public.games g ON g.id = gp.game_id
ON CONFLICT DO NOTHING;

CREATE INDEX idx_game_verifications_user_pending
  ON public.game_verifications (user_id) WHERE score_status = 'pending';
CREATE INDEX idx_game_verifications_game ON public.game_verifications (game_id);
