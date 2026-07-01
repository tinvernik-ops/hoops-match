ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_unique;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_when_set
  ON public.profiles (phone) WHERE phone <> '';