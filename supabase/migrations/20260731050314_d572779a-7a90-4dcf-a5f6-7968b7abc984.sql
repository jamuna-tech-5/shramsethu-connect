ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS documents_user_hash_idx ON public.documents (user_id, content_hash);