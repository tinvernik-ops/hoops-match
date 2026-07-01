-- Restore EXECUTE for trigger functions to roles that actually fire the triggers.
-- handle_new_user fires as supabase_auth_admin (trigger on auth.users).
-- Other triggers fire under whichever role writes to the underlying public table.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.create_game_verification() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_league_invite_accept() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_owner_as_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;