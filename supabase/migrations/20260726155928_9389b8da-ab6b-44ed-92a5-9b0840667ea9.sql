REVOKE EXECUTE ON FUNCTION public.recompute_gigscore(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_document(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recompute_gigscore_txn() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon, authenticated;