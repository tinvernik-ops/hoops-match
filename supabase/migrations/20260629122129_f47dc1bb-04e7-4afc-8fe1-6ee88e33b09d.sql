DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT id, username, avatar_url, height_cm, lat, lng, playstyle, preferred_game_type, location_updated_at, created_at, updated_at
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated;