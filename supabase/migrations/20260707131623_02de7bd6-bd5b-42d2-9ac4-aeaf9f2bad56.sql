
CREATE TABLE public.user_study_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id, youtube_id)
);

CREATE INDEX user_study_videos_user_topic_idx ON public.user_study_videos (user_id, topic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_study_videos TO authenticated;
GRANT ALL ON public.user_study_videos TO service_role;

ALTER TABLE public.user_study_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own study videos"
  ON public.user_study_videos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
