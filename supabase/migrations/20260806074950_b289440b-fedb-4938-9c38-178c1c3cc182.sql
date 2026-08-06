CREATE TABLE public.user_app_locks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  method text NOT NULL DEFAULT 'pin4',
  salt text,
  secret_hash text,
  iterations integer NOT NULL DEFAULT 150000,
  biometric_enabled boolean NOT NULL DEFAULT false,
  credential_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_app_locks TO authenticated;
GRANT ALL ON public.user_app_locks TO service_role;

ALTER TABLE public.user_app_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own app lock"
  ON public.user_app_locks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_app_locks_updated
  BEFORE UPDATE ON public.user_app_locks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();