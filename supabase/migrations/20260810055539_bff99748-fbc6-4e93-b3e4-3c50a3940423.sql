
CREATE TABLE IF NOT EXISTS public.admin_config (
  id smallint PRIMARY KEY DEFAULT 1,
  code_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_config_single_row CHECK (id = 1)
);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_config FROM anon, authenticated;
GRANT ALL ON public.admin_config TO service_role;

INSERT INTO public.admin_config (id, code_hash)
VALUES (1, md5('SHRAMSETHU2026'))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_code_ok(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE id = 1 AND code_hash = md5(btrim(coalesce(_code, '')))
  )
$$;

REVOKE ALL ON FUNCTION public.admin_code_ok(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_code_ok(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_workers(_code text, _search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _s text := nullif(btrim(coalesce(_search, '')), '');
  _out jsonb;
BEGIN
  IF NOT public.admin_code_ok(_code) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT coalesce(jsonb_agg(w ORDER BY w->>'created_at' DESC), '[]'::jsonb) INTO _out
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'phone', p.phone,
      'category', p.category,
      'status', p.status,
      'blocked', p.blocked,
      'photo_url', p.photo_url,
      'onboarded', p.onboarded,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'last_sign_in_at', NULL,
      'documents', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', d.id, 'user_id', d.user_id, 'kind', d.kind, 'status', d.status,
          'file_name', d.file_name, 'document_name', d.document_name,
          'storage_path', d.storage_path, 'mime_type', d.mime_type,
          'size_bytes', d.size_bytes, 'ocr_status', d.ocr_status,
          'confidence_score', d.confidence_score,
          'verification_reason', d.verification_reason,
          'ai_verified_at', d.ai_verified_at, 'verified_at', d.verified_at,
          'created_at', d.created_at
        ) ORDER BY d.created_at DESC), '[]'::jsonb)
        FROM public.documents d WHERE d.user_id = p.id
      ),
      'docs_verified', (SELECT count(*) FROM public.documents d WHERE d.user_id = p.id AND d.status = 'verified'),
      'docs_total', (SELECT count(*) FROM public.documents d WHERE d.user_id = p.id),
      'income', (
        SELECT jsonb_build_object(
          'count', coalesce(count(*), 0),
          'total', coalesce(sum(t.amount), 0),
          'last_at', max(t.occurred_on)
        )
        FROM public.transactions t WHERE t.user_id = p.id AND t.type = 'income'
      ),
      'gigscore', (
        SELECT g.score FROM public.gigscore_snapshots g
        WHERE g.user_id = p.id ORDER BY g.computed_at DESC LIMIT 1
      )
    ) AS w
    FROM public.profiles p
    WHERE _s IS NULL
      OR p.full_name ILIKE '%' || _s || '%'
      OR p.email ILIKE '%' || _s || '%'
      OR p.phone ILIKE '%' || _s || '%'
    ORDER BY p.created_at DESC
    LIMIT 500
  ) q;

  RETURN _out;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_workers(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_workers(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_worker_blocked(_code text, _id uuid, _blocked boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_code_ok(_code) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles SET blocked = _blocked WHERE id = _id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_worker_blocked(text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_worker_blocked(text, uuid, boolean) TO anon, authenticated, service_role;
