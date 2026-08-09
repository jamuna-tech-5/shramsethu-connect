-- =====================================================================
-- ShramSethu — complete database schema export
-- Target: a self-owned Supabase project (e.g. shramsethu-production)
--
-- Apply either way:
--   1) Supabase SQL Editor: paste this whole file and run.
--   2) CLI: supabase link --project-ref <ref> && supabase db push
--
-- Contents: enum types, tables, keys, indexes, functions, triggers,
-- grants, RLS + policies, function privileges, storage buckets/policies.
-- Data rows are NOT included (schema only).
-- NOTE: the trigger on auth.users (handle_new_user) is included; it must be
-- created by a role with rights on the auth schema (SQL Editor works).
-- =====================================================================

create extension if not exists pgcrypto;


-- =====================================================================
-- ENUM TYPES
-- =====================================================================

do $$ begin create type public.app_role as enum ('admin', 'moderator', 'user'); exception when duplicate_object then null; end $$;
do $$ begin create type public.application_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.doc_kind as enum ('aadhaar', 'pan', 'license', 'other', 'bank', 'identity', 'passport', 'voter_id', 'salary_slip', 'bank_statement', 'income_proof', 'payment_receipt', 'employment_letter'); exception when duplicate_object then null; end $$;
do $$ begin create type public.doc_status as enum ('not_uploaded', 'pending', 'verified', 'rejected', 'needs_review'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notif_kind as enum ('info', 'success', 'warning', 'alert'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sos_status as enum ('active', 'resolved', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.txn_type as enum ('income', 'expense'); exception when duplicate_object then null; end $$;
do $$ begin create type public.work_category as enum ('Delivery Partner', 'Driver', 'Construction Worker', 'Freelancer', 'Daily Wage Worker', 'Other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.worker_status as enum ('online', 'offline', 'on_duty', 'available'); exception when duplicate_object then null; end $$;

-- =====================================================================
-- TABLES
-- =====================================================================

create table if not exists public.admin_actions (
  id uuid default gen_random_uuid() not null,
  actor_id uuid not null,
  target_user_id uuid,
  target_document_id uuid,
  action text not null,
  note text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.app_lock_resets (
  id uuid default gen_random_uuid() not null,
  token_hash text not null,
  phone text not null,
  user_id uuid,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.documents (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  kind doc_kind not null,
  status doc_status default 'pending'::doc_status not null,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  rejection_reason text,
  verified_at timestamp with time zone,
  verified_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  document_name text,
  ocr_status text default 'queued'::text not null,
  ocr_text text,
  confidence_score integer,
  verification_reason text,
  ai_verified_at timestamp with time zone,
  income_source text,
  income_frequency text,
  extracted_amount numeric(12,2),
  extracted_date date,
  extracted_employer text,
  extracted_txn_ref text,
  is_income_proof boolean default false not null,
  content_hash text,
  income_month smallint,
  income_year smallint
);
create table if not exists public.emergency_contacts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  phone text not null,
  relation text,
  is_primary boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.gigscore_snapshots (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  score integer not null,
  breakdown jsonb default '{}'::jsonb not null,
  computed_at timestamp with time zone default now() not null
);
create table if not exists public.income_sources (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  kind text not null,
  name text not null,
  external_ref text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.insurance_policies (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  provider text not null,
  policy_number text,
  policy_type text,
  cover_amount numeric(12,2),
  premium_amount numeric(12,2),
  premium_frequency text,
  starts_on date,
  ends_on date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.loan_applications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  amount numeric(12,2) not null,
  purpose text,
  tenure_months integer,
  status application_status default 'draft'::application_status not null,
  gigscore_at_apply integer,
  monthly_income_at_apply numeric(12,2),
  decided_amount numeric(12,2),
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.location_pings (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  captured_at timestamp with time zone default now() not null
);
create table if not exists public.location_shares (
  id uuid default gen_random_uuid() not null,
  sender_id uuid not null,
  recipient_id uuid not null,
  mode text not null,
  latest_lat double precision,
  latest_lng double precision,
  message text,
  active boolean default true not null,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  kind notif_kind default 'info'::notif_kind not null,
  title text not null,
  body text,
  read boolean default false not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.profiles (
  id uuid not null,
  full_name text,
  email text,
  phone text,
  category work_category,
  skills text,
  experience text,
  location text,
  work_type text,
  languages text,
  emergency_name text,
  emergency_phone text,
  photo_url text,
  id_doc_name text,
  onboarded boolean default false not null,
  status worker_status default 'offline'::worker_status not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  blocked boolean default false not null
);
create table if not exists public.savings_goals (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  target_amount numeric(12,2) not null,
  saved_amount numeric(12,2) default 0 not null,
  target_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.scheme_applications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  scheme_id uuid not null,
  status application_status default 'draft'::application_status not null,
  submitted_at timestamp with time zone,
  decided_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.schemes (
  id uuid default gen_random_uuid() not null,
  code text not null,
  name text not null,
  authority text,
  category text,
  summary text,
  benefits text,
  eligibility text,
  url text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.sos_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  status sos_status default 'active'::sos_status not null,
  lat double precision,
  lng double precision,
  message text,
  triggered_at timestamp with time zone default now() not null,
  resolved_at timestamp with time zone
);
create table if not exists public.transactions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type txn_type not null,
  amount numeric(12,2) not null,
  category text,
  source text,
  occurred_on date default CURRENT_DATE not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  verified boolean default false not null,
  document_id uuid,
  frequency text,
  confidence_score integer
);
create table if not exists public.user_app_locks (
  user_id uuid not null,
  enabled boolean default false not null,
  method text default 'pin4'::text not null,
  salt text,
  secret_hash text,
  iterations integer default 150000 not null,
  biometric_enabled boolean default false not null,
  credential_id text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.user_roles (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  role app_role not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.user_settings (
  user_id uuid not null,
  notifications boolean default true not null,
  dark_mode boolean default false not null,
  location_sharing boolean default true not null,
  language text default 'en'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.work_history (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  employer text,
  category work_category,
  started_on date,
  ended_on date,
  on_time boolean,
  verified boolean default false not null,
  verified_at timestamp with time zone,
  earnings numeric(12,2),
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- =====================================================================
-- PRIMARY KEYS / UNIQUE / CHECK CONSTRAINTS
-- =====================================================================

do $$ begin alter table admin_actions add constraint admin_actions_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table app_lock_resets add constraint app_lock_resets_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table app_lock_resets add constraint app_lock_resets_token_hash_key UNIQUE (token_hash); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table documents add constraint documents_income_frequency_check CHECK ((income_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table documents add constraint documents_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table emergency_contacts add constraint emergency_contacts_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table gigscore_snapshots add constraint gigscore_snapshots_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table gigscore_snapshots add constraint gigscore_snapshots_score_check CHECK (((score >= 0) AND (score <= 1000))); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table income_sources add constraint income_sources_kind_check CHECK ((kind = ANY (ARRAY['gig_platform'::text, 'employer'::text, 'bank'::text, 'other'::text]))); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table income_sources add constraint income_sources_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table insurance_policies add constraint insurance_policies_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table loan_applications add constraint loan_applications_amount_check CHECK ((amount > (0)::numeric)); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table loan_applications add constraint loan_applications_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table location_pings add constraint location_pings_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table location_shares add constraint location_shares_mode_check CHECK ((mode = ANY (ARRAY['current'::text, 'live'::text]))); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table location_shares add constraint location_shares_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table notifications add constraint notifications_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table profiles add constraint profiles_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table savings_goals add constraint savings_goals_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table savings_goals add constraint savings_goals_saved_amount_check CHECK ((saved_amount >= (0)::numeric)); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table savings_goals add constraint savings_goals_target_amount_check CHECK ((target_amount > (0)::numeric)); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table scheme_applications add constraint scheme_applications_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table scheme_applications add constraint scheme_applications_user_id_scheme_id_key UNIQUE (user_id, scheme_id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table schemes add constraint schemes_code_key UNIQUE (code); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table schemes add constraint schemes_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table sos_events add constraint sos_events_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table transactions add constraint transactions_amount_check CHECK ((amount >= (0)::numeric)); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table transactions add constraint transactions_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table transactions add constraint transactions_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table user_app_locks add constraint user_app_locks_pkey PRIMARY KEY (user_id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table user_roles add constraint user_roles_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table user_roles add constraint user_roles_user_id_role_key UNIQUE (user_id, role); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table user_settings add constraint user_settings_pkey PRIMARY KEY (user_id); exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin alter table work_history add constraint work_history_pkey PRIMARY KEY (id); exception when duplicate_object then null; when duplicate_table then null; end $$;

-- =====================================================================
-- FOREIGN KEYS
-- =====================================================================

do $$ begin alter table admin_actions add constraint admin_actions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table admin_actions add constraint admin_actions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL; exception when duplicate_object then null; end $$;
do $$ begin alter table documents add constraint documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table documents add constraint documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id); exception when duplicate_object then null; end $$;
do $$ begin alter table emergency_contacts add constraint emergency_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table gigscore_snapshots add constraint gigscore_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table income_sources add constraint income_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table insurance_policies add constraint insurance_policies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table loan_applications add constraint loan_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table location_pings add constraint location_pings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table location_shares add constraint location_shares_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table location_shares add constraint location_shares_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table savings_goals add constraint savings_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table scheme_applications add constraint scheme_applications_scheme_id_fkey FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE RESTRICT; exception when duplicate_object then null; end $$;
do $$ begin alter table scheme_applications add constraint scheme_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table sos_events add constraint sos_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table transactions add constraint transactions_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL; exception when duplicate_object then null; end $$;
do $$ begin alter table transactions add constraint transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table user_app_locks add constraint user_app_locks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table user_roles add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table user_settings add constraint user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;
do $$ begin alter table work_history add constraint work_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; exception when duplicate_object then null; end $$;

-- =====================================================================
-- INDEXES
-- =====================================================================

CREATE INDEX IF NOT EXISTS documents_user_hash_idx ON public.documents USING btree (user_id, content_hash);
CREATE INDEX IF NOT EXISTS documents_user_id_kind_idx ON public.documents USING btree (user_id, kind);
CREATE INDEX IF NOT EXISTS gigscore_snapshots_user_id_computed_at_idx ON public.gigscore_snapshots USING btree (user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_lock_resets_token ON public.app_lock_resets USING btree (token_hash);
CREATE INDEX IF NOT EXISTS location_pings_user_id_captured_at_idx ON public.location_pings USING btree (user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS location_shares_recipient_active_idx ON public.location_shares USING btree (recipient_id, active);
CREATE INDEX IF NOT EXISTS location_shares_sender_active_idx ON public.location_shares USING btree (sender_id, active);
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sos_events_user_id_triggered_at_idx ON public.sos_events USING btree (user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS transactions_document_idx ON public.transactions USING btree (document_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_occurred_on_idx ON public.transactions USING btree (user_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS work_history_user_id_started_on_idx ON public.work_history USING btree (user_id, started_on DESC);

-- =====================================================================
-- FUNCTIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_review_document(_doc_id uuid, _decision text, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', new.phone)
  ) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$function$
;

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
END; $function$
;

CREATE OR REPLACE FUNCTION public.tg_recompute_gigscore_txn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN PERFORM public.recompute_gigscore(NEW.user_id); RETURN NEW; END $function$
;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end $function$
;

-- =====================================================================
-- TRIGGERS
-- =====================================================================

drop trigger if exists on_auth_user_created on auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
drop trigger if exists trg_docs_updated on documents;
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_ec_updated on emergency_contacts;
CREATE TRIGGER trg_ec_updated BEFORE UPDATE ON public.emergency_contacts FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_income_sources_updated on income_sources;
CREATE TRIGGER trg_income_sources_updated BEFORE UPDATE ON public.income_sources FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_ins_updated on insurance_policies;
CREATE TRIGGER trg_ins_updated BEFORE UPDATE ON public.insurance_policies FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_loan_updated on loan_applications;
CREATE TRIGGER trg_loan_updated BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_location_shares_updated on location_shares;
CREATE TRIGGER trg_location_shares_updated BEFORE UPDATE ON public.location_shares FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_profiles_updated on profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_savings_updated on savings_goals;
CREATE TRIGGER trg_savings_updated BEFORE UPDATE ON public.savings_goals FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_sa_updated on scheme_applications;
CREATE TRIGGER trg_sa_updated BEFORE UPDATE ON public.scheme_applications FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_schemes_updated on schemes;
CREATE TRIGGER trg_schemes_updated BEFORE UPDATE ON public.schemes FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_txn_gigscore on transactions;
CREATE TRIGGER trg_txn_gigscore AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION tg_recompute_gigscore_txn();
drop trigger if exists trg_txn_updated on transactions;
CREATE TRIGGER trg_txn_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_user_app_locks_updated on user_app_locks;
CREATE TRIGGER trg_user_app_locks_updated BEFORE UPDATE ON public.user_app_locks FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_settings_updated on user_settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
drop trigger if exists trg_work_updated on work_history;
CREATE TRIGGER trg_work_updated BEFORE UPDATE ON public.work_history FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

-- =====================================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================================

alter table public.admin_actions enable row level security;
alter table public.app_lock_resets enable row level security;
alter table public.documents enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.gigscore_snapshots enable row level security;
alter table public.income_sources enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.loan_applications enable row level security;
alter table public.location_pings enable row level security;
alter table public.location_shares enable row level security;
alter table public.notifications enable row level security;
alter table public.profiles enable row level security;
alter table public.savings_goals enable row level security;
alter table public.scheme_applications enable row level security;
alter table public.schemes enable row level security;
alter table public.sos_events enable row level security;
alter table public.transactions enable row level security;
alter table public.user_app_locks enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_settings enable row level security;
alter table public.work_history enable row level security;

-- =====================================================================
-- RLS POLICIES
-- =====================================================================

drop policy if exists "admin_actions_admin_read" on public.admin_actions;
create policy "admin_actions_admin_read" on public.admin_actions as permissive for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "docs_admin_update" on public.documents;
create policy "docs_admin_update" on public.documents as permissive for update to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "docs_owner_delete" on public.documents;
create policy "docs_owner_delete" on public.documents as permissive for delete to authenticated
  using ((user_id = auth.uid()));
drop policy if exists "docs_owner_insert" on public.documents;
create policy "docs_owner_insert" on public.documents as permissive for insert to authenticated
  with check ((user_id = auth.uid()));
drop policy if exists "docs_owner_select" on public.documents;
create policy "docs_owner_select" on public.documents as permissive for select to authenticated
  using (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
drop policy if exists "docs_owner_update" on public.documents;
create policy "docs_owner_update" on public.documents as permissive for update to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "ec_owner_all" on public.emergency_contacts;
create policy "ec_owner_all" on public.emergency_contacts as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "gs_admin_select" on public.gigscore_snapshots;
create policy "gs_admin_select" on public.gigscore_snapshots as permissive for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "gs_owner_all" on public.gigscore_snapshots;
create policy "gs_owner_all" on public.gigscore_snapshots as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "income_sources_admin_read" on public.income_sources;
create policy "income_sources_admin_read" on public.income_sources as permissive for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "income_sources_owner_all" on public.income_sources;
create policy "income_sources_owner_all" on public.income_sources as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "ins_owner_all" on public.insurance_policies;
create policy "ins_owner_all" on public.insurance_policies as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "loan_admin_select" on public.loan_applications;
create policy "loan_admin_select" on public.loan_applications as permissive for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "loan_admin_update" on public.loan_applications;
create policy "loan_admin_update" on public.loan_applications as permissive for update to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "loan_owner_all" on public.loan_applications;
create policy "loan_owner_all" on public.loan_applications as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "loc_owner_all" on public.location_pings;
create policy "loc_owner_all" on public.location_pings as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "loc_shares_participant_select" on public.location_shares;
create policy "loc_shares_participant_select" on public.location_shares as permissive for select to authenticated
  using (((sender_id = auth.uid()) OR (recipient_id = auth.uid())));
drop policy if exists "loc_shares_sender_insert" on public.location_shares;
create policy "loc_shares_sender_insert" on public.location_shares as permissive for insert to authenticated
  with check ((sender_id = auth.uid()));
drop policy if exists "loc_shares_sender_update" on public.location_shares;
create policy "loc_shares_sender_update" on public.location_shares as permissive for update to authenticated
  using ((sender_id = auth.uid()))
  with check ((sender_id = auth.uid()));
drop policy if exists "notif_owner_all" on public.notifications;
create policy "notif_owner_all" on public.notifications as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "notifications_owner_update" on public.notifications;
create policy "notifications_owner_update" on public.notifications as permissive for update to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles as permissive for update to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles as permissive for insert to authenticated
  with check ((auth.uid() = id));
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles as permissive for select to authenticated
  using (((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role)));
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles as permissive for update to authenticated
  using ((auth.uid() = id))
  with check ((auth.uid() = id));
drop policy if exists "savings_owner_all" on public.savings_goals;
create policy "savings_owner_all" on public.savings_goals as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "sa_admin_select" on public.scheme_applications;
create policy "sa_admin_select" on public.scheme_applications as permissive for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "sa_admin_update" on public.scheme_applications;
create policy "sa_admin_update" on public.scheme_applications as permissive for update to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "sa_owner_all" on public.scheme_applications;
create policy "sa_owner_all" on public.scheme_applications as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "schemes_admin_write" on public.schemes;
create policy "schemes_admin_write" on public.schemes as permissive for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "schemes_public_read" on public.schemes;
create policy "schemes_public_read" on public.schemes as permissive for select to anon, authenticated
  using (active);
drop policy if exists "sos_admin_select" on public.sos_events;
create policy "sos_admin_select" on public.sos_events as permissive for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "sos_owner_all" on public.sos_events;
create policy "sos_owner_all" on public.sos_events as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "txn_owner_all" on public.transactions;
create policy "txn_owner_all" on public.transactions as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "Users manage their own app lock" on public.user_app_locks;
create policy "Users manage their own app lock" on public.user_app_locks as permissive for all to authenticated
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
drop policy if exists "roles_self_select" on public.user_roles;
create policy "roles_self_select" on public.user_roles as permissive for select to authenticated
  using (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
drop policy if exists "settings_owner_all" on public.user_settings;
create policy "settings_owner_all" on public.user_settings as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists "work_admin_select" on public.work_history;
create policy "work_admin_select" on public.work_history as permissive for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
drop policy if exists "work_owner_all" on public.work_history;
create policy "work_owner_all" on public.work_history as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- =====================================================================
-- FUNCTION EXECUTE PRIVILEGES
-- =====================================================================

revoke all on function public.admin_review_document(uuid,text,text) from public;
grant execute on function public.admin_review_document(uuid,text,text) to authenticated
grant execute on function public.admin_review_document(uuid,text,text) to service_role
revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to service_role
revoke all on function public.has_role(uuid,app_role) from public;
grant execute on function public.has_role(uuid,app_role) to authenticated
grant execute on function public.has_role(uuid,app_role) to service_role
revoke all on function public.recompute_gigscore(uuid) from public;
grant execute on function public.recompute_gigscore(uuid) to authenticated
grant execute on function public.recompute_gigscore(uuid) to service_role
revoke all on function public.tg_recompute_gigscore_txn() from public;
grant execute on function public.tg_recompute_gigscore_txn() to service_role
revoke all on function public.tg_set_updated_at() from public;
grant execute on function public.tg_set_updated_at() to service_role

-- =====================================================================
-- STORAGE BUCKETS
-- =====================================================================

insert into storage.buckets (id, name, public) values ('documents','documents',false) on conflict (id) do nothing;

-- =====================================================================
-- STORAGE OBJECT POLICIES
-- =====================================================================

drop policy if exists "docs_bucket_admin_select" on storage.objects;
create policy "docs_bucket_admin_select" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'documents'::text) AND has_role(auth.uid(), 'admin'::app_role)));
drop policy if exists "docs_bucket_owner_delete" on storage.objects;
create policy "docs_bucket_owner_delete" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
drop policy if exists "docs_bucket_owner_insert" on storage.objects;
create policy "docs_bucket_owner_insert" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
drop policy if exists "docs_bucket_owner_select" on storage.objects;
create policy "docs_bucket_owner_select" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
drop policy if exists "docs_bucket_owner_update" on storage.objects;
create policy "docs_bucket_owner_update" on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))
  with check (((bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
