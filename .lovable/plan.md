## Approach

Lovable Cloud (managed Postgres + Auth + Storage) replaces the requested Express/Prisma/JWT stack — same features, runs inside your existing TanStack Start app, no separate server to host. Frontend UI, routes, colors, animations stay untouched. I only:

- Swap `src/lib/store.tsx` from `localStorage` to real Supabase Auth + profile row (same `useStore` API, same fields, so pages keep working).
- Add server functions under `src/lib/*.functions.ts` for each feature.
- Add pages' data-fetching (React Query) inside existing components — no visual changes.

Google Maps connector will be linked for EV / fuel / mechanic / hospital / rest / routes.

## Phase 1 — Auth + Profile foundation (this turn)

1. Migration: enums + `profiles`, `user_roles`, `has_role()`, RLS + GRANTs, storage bucket `documents` (private), signup trigger auto-creating a `profiles` row.
2. Enable Google sign-in via `supabase--configure_social_auth`.
3. Rewrite `src/lib/store.tsx` to use Supabase Auth (email/password + Google), load/persist the profile row, keep the same `Profile` shape + `useStore()` API used by every page.
4. Wire `src/routes/auth.tsx`, `src/routes/onboarding.tsx`, `src/routes/app.tsx`, `src/routes/app.profile.tsx` to real auth/profile (no UI changes — only replace store calls).

## Phase 2 — Core data tables + server fns

Tables (all with RLS scoped to `auth.uid()`, GRANTs, service_role):
`work_history`, `income_records`, `expense_records`, `savings`, `emergency_contacts`, `documents`, `notifications`, `sos_events`, `location_pings`, `settings`, `schemes` (curated public), `scheme_applications`, `loan_applications`, `insurance_policies`.

Server functions (`createServerFn` + `requireSupabaseAuth`) for full CRUD + aggregations feeding: dashboard, income, GigScore, schemes, loans, documents, SOS, settings, admin.

## Phase 3 — GigScore engine

Server fn calculates score only when `work_history` has ≥ 10 verified entries AND documents `aadhaar`+`pan` are verified, else returns `{ status: "insufficient_data", message: "Your GigScore will be calculated after verified work activity is added." }`. Score inputs: verified job count, on-time rate, income consistency (stddev), tenure, document verification. Result cached in `gigscore_snapshots`.

## Phase 4 — Loan eligibility + Schemes

- `loan-eligibility.functions.ts`: rule-based eligibility using GigScore, monthly income avg, expense ratio, tenure. Returns eligible amount + reasons, or "insufficient data".
- Seed a small curated `schemes` catalog (real Indian schemes: PM-SYM, e-Shram, PMSBY, PMJJBY, Ayushman Bharat) via migration — factual reference data, not fake user records.

## Phase 5 — Documents (Supabase Storage)

- Private `documents` bucket + RLS on `storage.objects` scoped to `auth.uid()/*`.
- Server fn `uploadDocument` (signed upload URL) + `listMyDocuments`. Verification status: `pending | verified | rejected` (admin sets).

## Phase 6 — Location + Google Maps connector

- Connect Google Maps connector (`standard_connectors--connect google_maps`).
- `saveLocation` server fn → `location_pings` table.
- Nearby endpoints via Places API (New) `places:searchNearby` through the gateway: EV charging, fuel, mechanics, hospitals, rest stops. Each returns real Google Places results or empty array — never fake.
- `smartRoute` server fn using Routes API `computeRoutes` for distance/ETA/traffic.
- Existing pages call new server fns via React Query; UI unchanged.

## Phase 7 — SOS + Notifications + Settings

- SOS server fn creates `sos_events` row with location + notifies emergency contacts (row insert; real SMS gateway can be added later behind a secret).
- Notifications: table + server fns, Realtime subscription in AppShell (no UI change beyond bell badge count if that already exists).
- Settings CRUD.

## Phase 8 — Admin

- Role gating via `has_role(uid, 'admin')`.
- Admin server fns: list workers, pending verification requests, document requests, aggregate analytics. Returns empty arrays until real data exists.

## Technical details

- Every `createServerFn` uses `.middleware([requireSupabaseAuth])`; bearer already attached by generated `attachSupabaseAuth`.
- All tables: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → policies (per public-schema-grants rule).
- Roles in separate `user_roles` table with `has_role()` security-definer function (never on profiles).
- No `.single()` on optional reads (use `.maybeSingle()`).
- No fake data anywhere — empty arrays / `insufficient_data` shapes.
- Auth-required pages stay under existing `/app/*` client guard; no visual changes to the auth flow, onboarding stepper, or any dashboard.
- Google Maps calls go through the Lovable connector gateway from server functions only.

## Deliverable per turn

I'll ship in phases; each phase compiles cleanly and leaves the app usable. This first turn = Phase 1 (auth + profile) so you can immediately sign up, sign in with Google, complete onboarding, and edit the profile against real Cloud data. Subsequent turns pick up phases 2–8.
