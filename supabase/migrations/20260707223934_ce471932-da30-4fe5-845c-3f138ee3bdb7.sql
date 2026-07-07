DROP POLICY IF EXISTS "Profiles visible to authenticated" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);