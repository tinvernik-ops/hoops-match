
DROP POLICY IF EXISTS "Authenticated read public profile columns" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated read rating scores" ON public.ratings;

DROP POLICY IF EXISTS "cas_select_auth" ON public.court_alert_state;
REVOKE SELECT ON public.court_alert_state FROM authenticated;

ALTER FUNCTION public.get_my_profile() SECURITY INVOKER;
