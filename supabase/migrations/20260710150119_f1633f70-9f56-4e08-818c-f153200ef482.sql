
-- Ensure RLS policy has WITH CHECK so upserts pass
DROP POLICY IF EXISTS "Users manage own study plan" ON public.user_study_plan;
CREATE POLICY "Users manage own study plan"
  ON public.user_study_plan
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
