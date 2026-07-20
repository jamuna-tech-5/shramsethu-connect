
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'doc_kind'::regtype AND enumlabel = 'bank') THEN
    ALTER TYPE doc_kind ADD VALUE 'bank';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'doc_kind'::regtype AND enumlabel = 'identity') THEN
    ALTER TYPE doc_kind ADD VALUE 'identity';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('gig_platform','employer','bank','other')),
  name TEXT NOT NULL,
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_sources TO authenticated;
GRANT ALL ON public.income_sources TO service_role;
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "income_sources_owner_all" ON public.income_sources;
CREATE POLICY "income_sources_owner_all" ON public.income_sources
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "income_sources_admin_read" ON public.income_sources;
CREATE POLICY "income_sources_admin_read" ON public.income_sources
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_income_sources_updated ON public.income_sources;
CREATE TRIGGER trg_income_sources_updated BEFORE UPDATE ON public.income_sources
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.location_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('current','live')),
  latest_lat DOUBLE PRECISION,
  latest_lng DOUBLE PRECISION,
  message TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS location_shares_recipient_active_idx ON public.location_shares(recipient_id, active);
CREATE INDEX IF NOT EXISTS location_shares_sender_active_idx ON public.location_shares(sender_id, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_shares TO authenticated;
GRANT ALL ON public.location_shares TO service_role;
ALTER TABLE public.location_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loc_shares_participant_select" ON public.location_shares;
CREATE POLICY "loc_shares_participant_select" ON public.location_shares
  FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
DROP POLICY IF EXISTS "loc_shares_sender_insert" ON public.location_shares;
CREATE POLICY "loc_shares_sender_insert" ON public.location_shares
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS "loc_shares_sender_update" ON public.location_shares;
CREATE POLICY "loc_shares_sender_update" ON public.location_shares
  FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
DROP TRIGGER IF EXISTS trg_location_shares_updated ON public.location_shares;
CREATE TRIGGER trg_location_shares_updated BEFORE UPDATE ON public.location_shares
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_document_id UUID,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_actions_admin_read" ON public.admin_actions;
CREATE POLICY "admin_actions_admin_read" ON public.admin_actions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.recompute_gigscore(_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p RECORD; verified_docs INT; verified_work INT; income_months INT; activity_days INT;
  profile_score INT := 0; doc_score INT := 0; work_score INT := 0; income_score INT := 0; activity_score INT := 0;
  total INT; breakdown JSONB;
BEGIN
  SELECT full_name, phone, category, skills, experience, location, work_type, emergency_phone, photo_url
    INTO p FROM public.profiles WHERE id = _user_id;
  IF FOUND THEN
    profile_score := (
      CASE WHEN COALESCE(p.full_name,'') <> '' THEN 3 ELSE 0 END +
      CASE WHEN COALESCE(p.phone,'') <> '' THEN 3 ELSE 0 END +
      CASE WHEN p.category IS NOT NULL THEN 3 ELSE 0 END +
      CASE WHEN COALESCE(p.skills,'') <> '' THEN 2 ELSE 0 END +
      CASE WHEN COALESCE(p.experience,'') <> '' THEN 2 ELSE 0 END +
      CASE WHEN COALESCE(p.location,'') <> '' THEN 2 ELSE 0 END +
      CASE WHEN COALESCE(p.emergency_phone,'') <> '' THEN 3 ELSE 0 END +
      CASE WHEN COALESCE(p.photo_url,'') <> '' THEN 2 ELSE 0 END
    );
  END IF;
  SELECT COUNT(*) INTO verified_docs FROM public.documents WHERE user_id = _user_id AND status = 'verified';
  doc_score := LEAST(verified_docs * 6, 25);
  SELECT COUNT(*) INTO verified_work FROM public.work_history WHERE user_id = _user_id AND verified = TRUE;
  work_score := LEAST(verified_work * 3, 30);
  SELECT COUNT(DISTINCT date_trunc('month', occurred_on)) INTO income_months FROM public.transactions
    WHERE user_id = _user_id AND type = 'income' AND occurred_on >= (CURRENT_DATE - INTERVAL '12 months');
  income_score := LEAST(income_months * 2, 15);
  SELECT COUNT(DISTINCT DATE(created_at)) INTO activity_days FROM public.location_pings
    WHERE user_id = _user_id AND created_at >= (CURRENT_DATE - INTERVAL '30 days');
  activity_score := LEAST(activity_days, 10);
  total := profile_score + doc_score + work_score + income_score + activity_score;
  breakdown := jsonb_build_object('profile', profile_score, 'documents', doc_score, 'work_history', work_score, 'income', income_score, 'activity', activity_score);
  INSERT INTO public.gigscore_snapshots (user_id, score, breakdown, computed_at) VALUES (_user_id, total, breakdown, now());
  RETURN total;
END; $$;
REVOKE ALL ON FUNCTION public.recompute_gigscore(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_gigscore(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_document(_doc_id UUID, _decision TEXT, _note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID; _actor UUID := auth.uid();
BEGIN
  IF NOT public.has_role(_actor, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('verified','rejected') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  UPDATE public.documents SET status = _decision::doc_status,
    verified_at = CASE WHEN _decision = 'verified' THEN now() ELSE NULL END,
    verified_by = _actor,
    rejection_reason = CASE WHEN _decision = 'rejected' THEN _note ELSE NULL END
    WHERE id = _doc_id RETURNING user_id INTO _uid;
  IF _uid IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;
  INSERT INTO public.admin_actions (actor_id, target_user_id, target_document_id, action, note)
    VALUES (_actor, _uid, _doc_id, 'document_' || _decision, _note);
  INSERT INTO public.notifications (user_id, kind, title, body) VALUES (
    _uid,
    CASE WHEN _decision = 'verified' THEN 'success' ELSE 'warning' END,
    CASE WHEN _decision = 'verified' THEN 'Document verified' ELSE 'Document rejected' END,
    COALESCE(_note, CASE WHEN _decision = 'verified' THEN 'Your document has been approved.' ELSE 'Please re-upload your document.' END)
  );
  PERFORM public.recompute_gigscore(_uid);
END; $$;
REVOKE ALL ON FUNCTION public.admin_review_document(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_document(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_recompute_gigscore_txn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.recompute_gigscore(NEW.user_id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_txn_gigscore ON public.transactions;
CREATE TRIGGER trg_txn_gigscore AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_gigscore_txn();

DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
CREATE POLICY "notifications_owner_update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
