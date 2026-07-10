
REVOKE EXECUTE ON FUNCTION public.handle_league_invite_accept() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.create_game_verification() FROM authenticated, anon, public;
