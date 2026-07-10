DROP POLICY IF EXISTS "Authenticated users read cache" ON public.ai_response_cache;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_response_cache FROM authenticated, anon;
GRANT ALL ON public.ai_response_cache TO service_role;