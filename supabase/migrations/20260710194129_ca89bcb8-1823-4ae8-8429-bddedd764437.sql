DROP POLICY IF EXISTS "Authenticated users can read non-expired cache" ON public.ai_response_cache;
REVOKE SELECT ON public.ai_response_cache FROM authenticated;