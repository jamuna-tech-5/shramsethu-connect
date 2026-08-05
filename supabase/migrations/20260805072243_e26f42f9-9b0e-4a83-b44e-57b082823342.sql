CREATE TABLE public.app_lock_resets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  phone text NOT NULL,
  user_id uuid,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_lock_resets TO service_role;

ALTER TABLE public.app_lock_resets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_app_lock_resets_token ON public.app_lock_resets (token_hash);