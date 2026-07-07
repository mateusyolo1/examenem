CREATE TABLE public.user_video_suggestion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  youtube_id text NOT NULL,
  title text,
  channel_name text,
  duration_seconds int,
  suggested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id, youtube_id)
);

CREATE INDEX user_video_suggestion_history_user_topic_idx
  ON public.user_video_suggestion_history (user_id, topic_id, suggested_at DESC);

GRANT SELECT, INSERT, DELETE ON public.user_video_suggestion_history TO authenticated;
GRANT ALL ON public.user_video_suggestion_history TO service_role;

ALTER TABLE public.user_video_suggestion_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own suggestion history select"
  ON public.user_video_suggestion_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own suggestion history insert"
  ON public.user_video_suggestion_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own suggestion history delete"
  ON public.user_video_suggestion_history
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);