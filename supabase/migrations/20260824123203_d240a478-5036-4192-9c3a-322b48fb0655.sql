REVOKE ALL ON FUNCTION public.current_user_permissions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_login_identifier(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO service_role;