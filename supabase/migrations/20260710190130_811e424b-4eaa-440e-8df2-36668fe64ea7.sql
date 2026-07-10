REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;