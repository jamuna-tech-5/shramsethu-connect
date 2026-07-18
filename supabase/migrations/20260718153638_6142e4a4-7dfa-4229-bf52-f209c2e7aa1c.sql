
-- =============== ENUMS ===============
create type public.app_role as enum ('admin', 'moderator', 'user');
create type public.doc_status as enum ('not_uploaded', 'pending', 'verified', 'rejected');
create type public.doc_kind as enum ('aadhaar', 'pan', 'license', 'other');
create type public.worker_status as enum ('online', 'offline', 'on_duty', 'available');
create type public.work_category as enum ('Delivery Partner', 'Driver', 'Construction Worker', 'Freelancer', 'Daily Wage Worker', 'Other');
create type public.txn_type as enum ('income', 'expense');
create type public.application_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected');
create type public.sos_status as enum ('active', 'resolved', 'cancelled');
create type public.notif_kind as enum ('info', 'success', 'warning', 'alert');

-- =============== UPDATED_AT HELPER ===============
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- =============== PROFILES ===============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  category public.work_category,
  skills text,
  experience text,
  location text,
  work_type text,
  languages text,
  emergency_name text,
  emergency_phone text,
  photo_url text,
  id_doc_name text,
  onboarded boolean not null default false,
  status public.worker_status not null default 'offline',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.tg_set_updated_at();

-- =============== USER ROLES ===============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Profiles RLS (owner + admin)
create policy "profiles_self_select" on public.profiles for select to authenticated using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_admin_update" on public.profiles for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- User roles RLS
create policy "roles_self_select" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- =============== USER SETTINGS ===============
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notifications boolean not null default true,
  dark_mode boolean not null default false,
  location_sharing boolean not null default true,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_settings to authenticated;
grant all on public.user_settings to service_role;
alter table public.user_settings enable row level security;
create policy "settings_owner_all" on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_settings_updated before update on public.user_settings for each row execute function public.tg_set_updated_at();

-- =============== SIGNUP TRIGGER ===============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- =============== DOCUMENTS ===============
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.doc_kind not null,
  status public.doc_status not null default 'pending',
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  rejection_reason text,
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, storage_path)
);
create index on public.documents (user_id, kind);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "docs_owner_select" on public.documents for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "docs_owner_insert" on public.documents for insert to authenticated with check (user_id = auth.uid());
create policy "docs_owner_update" on public.documents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "docs_admin_update" on public.documents for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "docs_owner_delete" on public.documents for delete to authenticated using (user_id = auth.uid());
create trigger trg_docs_updated before update on public.documents for each row execute function public.tg_set_updated_at();

-- =============== WORK HISTORY ===============
create table public.work_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  employer text,
  category public.work_category,
  started_on date,
  ended_on date,
  on_time boolean,
  verified boolean not null default false,
  verified_at timestamptz,
  earnings numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.work_history (user_id, started_on desc);
grant select, insert, update, delete on public.work_history to authenticated;
grant all on public.work_history to service_role;
alter table public.work_history enable row level security;
create policy "work_owner_all" on public.work_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "work_admin_select" on public.work_history for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger trg_work_updated before update on public.work_history for each row execute function public.tg_set_updated_at();

-- =============== INCOME / EXPENSE ===============
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.txn_type not null,
  amount numeric(12,2) not null check (amount >= 0),
  category text,
  source text,
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.transactions (user_id, occurred_on desc);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "txn_owner_all" on public.transactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_txn_updated before update on public.transactions for each row execute function public.tg_set_updated_at();

-- =============== SAVINGS ===============
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  saved_amount numeric(12,2) not null default 0 check (saved_amount >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.savings_goals to authenticated;
grant all on public.savings_goals to service_role;
alter table public.savings_goals enable row level security;
create policy "savings_owner_all" on public.savings_goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_savings_updated before update on public.savings_goals for each row execute function public.tg_set_updated_at();

-- =============== EMERGENCY CONTACTS ===============
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  relation text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.emergency_contacts to authenticated;
grant all on public.emergency_contacts to service_role;
alter table public.emergency_contacts enable row level security;
create policy "ec_owner_all" on public.emergency_contacts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_ec_updated before update on public.emergency_contacts for each row execute function public.tg_set_updated_at();

-- =============== LOCATION PINGS ===============
create table public.location_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  captured_at timestamptz not null default now()
);
create index on public.location_pings (user_id, captured_at desc);
grant select, insert, delete on public.location_pings to authenticated;
grant all on public.location_pings to service_role;
alter table public.location_pings enable row level security;
create policy "loc_owner_all" on public.location_pings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============== SOS EVENTS ===============
create table public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.sos_status not null default 'active',
  lat double precision,
  lng double precision,
  message text,
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on public.sos_events (user_id, triggered_at desc);
grant select, insert, update, delete on public.sos_events to authenticated;
grant all on public.sos_events to service_role;
alter table public.sos_events enable row level security;
create policy "sos_owner_all" on public.sos_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sos_admin_select" on public.sos_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- =============== NOTIFICATIONS ===============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.notif_kind not null default 'info',
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif_owner_all" on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============== SCHEMES CATALOG (public) ===============
create table public.schemes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  authority text,
  category text,
  summary text,
  benefits text,
  eligibility text,
  url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.schemes to anon, authenticated;
grant all on public.schemes to service_role;
alter table public.schemes enable row level security;
create policy "schemes_public_read" on public.schemes for select to anon, authenticated using (active);
create policy "schemes_admin_write" on public.schemes for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger trg_schemes_updated before update on public.schemes for each row execute function public.tg_set_updated_at();

-- Seed real Indian schemes (factual reference data, not user records)
insert into public.schemes (code, name, authority, category, summary, benefits, eligibility, url) values
  ('e-shram', 'e-Shram Card', 'Ministry of Labour & Employment', 'Registration', 'National database registration for unorganised workers.', 'Universal Account Number, access to welfare schemes, ₹2 lakh accidental insurance.', 'Unorganised workers aged 16–59 not covered under EPFO/ESIC.', 'https://eshram.gov.in'),
  ('pm-sym', 'PM Shram Yogi Maandhan (PM-SYM)', 'Ministry of Labour & Employment', 'Pension', 'Voluntary pension scheme for unorganised workers.', 'Minimum ₹3,000/month pension after age 60.', 'Unorganised workers aged 18–40 with monthly income up to ₹15,000.', 'https://maandhan.in'),
  ('pmsby', 'Pradhan Mantri Suraksha Bima Yojana', 'Department of Financial Services', 'Insurance', 'Accidental death and disability insurance at ₹20/year.', '₹2 lakh accidental death / permanent disability cover.', 'Indian bank account holders aged 18–70.', 'https://financialservices.gov.in/beta/en/pmsby'),
  ('pmjjby', 'Pradhan Mantri Jeevan Jyoti Bima Yojana', 'Department of Financial Services', 'Insurance', 'Life insurance at ₹436/year.', '₹2 lakh life cover on death from any cause.', 'Indian bank account holders aged 18–50.', 'https://financialservices.gov.in/beta/en/pmjjby'),
  ('ayushman', 'Ayushman Bharat PM-JAY', 'National Health Authority', 'Health', 'Health cover for economically vulnerable families.', 'Cashless hospitalization up to ₹5 lakh per family per year.', 'Families listed in SECC 2011 database.', 'https://pmjay.gov.in');

-- =============== SCHEME APPLICATIONS ===============
create table public.scheme_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheme_id uuid not null references public.schemes(id) on delete restrict,
  status public.application_status not null default 'draft',
  submitted_at timestamptz,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheme_id)
);
grant select, insert, update, delete on public.scheme_applications to authenticated;
grant all on public.scheme_applications to service_role;
alter table public.scheme_applications enable row level security;
create policy "sa_owner_all" on public.scheme_applications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sa_admin_select" on public.scheme_applications for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "sa_admin_update" on public.scheme_applications for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger trg_sa_updated before update on public.scheme_applications for each row execute function public.tg_set_updated_at();

-- =============== LOAN APPLICATIONS ===============
create table public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  purpose text,
  tenure_months integer,
  status public.application_status not null default 'draft',
  gigscore_at_apply integer,
  monthly_income_at_apply numeric(12,2),
  decided_amount numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.loan_applications to authenticated;
grant all on public.loan_applications to service_role;
alter table public.loan_applications enable row level security;
create policy "loan_owner_all" on public.loan_applications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "loan_admin_select" on public.loan_applications for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "loan_admin_update" on public.loan_applications for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger trg_loan_updated before update on public.loan_applications for each row execute function public.tg_set_updated_at();

-- =============== INSURANCE POLICIES ===============
create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  policy_number text,
  policy_type text,
  cover_amount numeric(12,2),
  premium_amount numeric(12,2),
  premium_frequency text,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.insurance_policies to authenticated;
grant all on public.insurance_policies to service_role;
alter table public.insurance_policies enable row level security;
create policy "ins_owner_all" on public.insurance_policies for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trg_ins_updated before update on public.insurance_policies for each row execute function public.tg_set_updated_at();

-- =============== GIGSCORE SNAPSHOTS ===============
create table public.gigscore_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 1000),
  breakdown jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);
create index on public.gigscore_snapshots (user_id, computed_at desc);
grant select, insert, delete on public.gigscore_snapshots to authenticated;
grant all on public.gigscore_snapshots to service_role;
alter table public.gigscore_snapshots enable row level security;
create policy "gs_owner_all" on public.gigscore_snapshots for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gs_admin_select" on public.gigscore_snapshots for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- =============== STORAGE BUCKET ===============
-- Documents bucket (private). Handled in a follow-up storage tool call.
