-- Lock down internal/trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_recompute_gigscore_txn() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Add an in-function authorization check to recompute_gigscore
CREATE OR REPLACE FUNCTION public.recompute_gigscore(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  verified_docs INT := 0; verified_work INT := 0; income_months INT := 0;
  activity_days INT := 0; income_total NUMERIC := 0; income_txns INT := 0;
  doc_score INT := 0; work_score INT := 0; income_score INT := 0;
  consistency_score INT := 0; volume_score INT := 0; activity_score INT := 0;
  total INT; breakdown JSONB;
BEGIN
  -- Only the owner, an admin, or trusted server-side/trigger contexts may recompute.
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount),0),
         COUNT(DISTINCT date_trunc('month', occurred_on))
    INTO income_txns, income_total, income_months
    FROM public.transactions
    WHERE user_id = _user_id AND type = 'income' AND verified = TRUE
      AND occurred_on >= (CURRENT_DATE - INTERVAL '12 months');

  IF income_txns = 0 THEN
    RETURN NULL;
  END IF;

  volume_score := LEAST((income_total / 5000.0)::INT * 3, 30);
  income_score := LEAST(income_txns * 4, 20);
  consistency_score := LEAST(income_months * 3, 15);

  SELECT COUNT(*) INTO verified_work FROM public.work_history
    WHERE user_id = _user_id AND verified = TRUE;
  work_score := LEAST(verified_work * 3, 15);

  SELECT COUNT(*) INTO verified_docs FROM public.documents
    WHERE user_id = _user_id AND status = 'verified';
  doc_score := LEAST(verified_docs * 3, 15);

  SELECT COUNT(DISTINCT DATE(captured_at)) INTO activity_days FROM public.location_pings
    WHERE user_id = _user_id AND captured_at >= (CURRENT_DATE - INTERVAL '30 days');
  activity_score := LEAST(activity_days, 5);

  total := volume_score + income_score + consistency_score + work_score + doc_score + activity_score;
  breakdown := jsonb_build_object(
    'income_volume', volume_score,
    'income_records', income_score,
    'consistency', consistency_score,
    'work_history', work_score,
    'documents', doc_score,
    'activity', activity_score
  );

  INSERT INTO public.gigscore_snapshots (user_id, score, breakdown, computed_at)
  VALUES (_user_id, total, breakdown, now());
  RETURN total;
END; $function$;

REVOKE ALL ON FUNCTION public.recompute_gigscore(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_gigscore(uuid) TO authenticated, service_role;

-- has_role and admin_review_document must stay callable by signed-in users
-- (RLS policies and the admin review flow depend on them); both are safe:
-- has_role is a read-only lookup and admin_review_document checks admin role internally.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_review_document(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_document(uuid, text, text) TO authenticated, service_role;