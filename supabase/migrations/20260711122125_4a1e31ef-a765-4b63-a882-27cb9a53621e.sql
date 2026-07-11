GRANT UPDATE ON public.user_video_suggestion_history TO authenticated;

DROP POLICY IF EXISTS "own suggestion history update" ON public.user_video_suggestion_history;
CREATE POLICY "own suggestion history update"
  ON public.user_video_suggestion_history
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
