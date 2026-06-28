
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.direct_messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.league_messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.league_messages ALTER COLUMN body DROP NOT NULL;

ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_body_or_image;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_body_or_image
  CHECK ((body IS NOT NULL AND length(btrim(body)) > 0) OR image_url IS NOT NULL);
ALTER TABLE public.league_messages DROP CONSTRAINT IF EXISTS league_messages_body_or_image;
ALTER TABLE public.league_messages ADD CONSTRAINT league_messages_body_or_image
  CHECK ((body IS NOT NULL AND length(btrim(body)) > 0) OR image_url IS NOT NULL);

DROP POLICY IF EXISTS "chat-images authenticated read" ON storage.objects;
CREATE POLICY "chat-images authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "chat-images authenticated upload" ON storage.objects;
CREATE POLICY "chat-images authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "chat-images owner delete" ON storage.objects;
CREATE POLICY "chat-images owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);
