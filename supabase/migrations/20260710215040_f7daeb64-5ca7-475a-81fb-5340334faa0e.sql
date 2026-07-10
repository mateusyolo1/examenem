CREATE TABLE public.user_hints_seen (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hint_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hint_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_hints_seen TO authenticated;
GRANT ALL ON public.user_hints_seen TO service_role;

ALTER TABLE public.user_hints_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hints"
  ON public.user_hints_seen FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hints"
  ON public.user_hints_seen FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hints"
  ON public.user_hints_seen FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);