
CREATE POLICY "Users read own books files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own books files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own books files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own books files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);
