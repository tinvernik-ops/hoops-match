CREATE OR REPLACE FUNCTION public.can_rate(_rater uuid, _ratee uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE EXECUTE ON FUNCTION public.can_rate(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_rate(uuid, uuid) TO authenticated;