# ShramSethu — Integrated Completion Plan

Preserves existing UI, routes, and Supabase schema. Fills the functional gaps across four bundles as one coherent release.

## 1. Admin + Auth
- New route `src/routes/admin.login.tsx` — email/password sign in that verifies `has_role(admin)` server-side before letting the session through; workers hitting it get an "access denied" state.
- Migration: add `blocked boolean` to `profiles`, add `admin_actions` audit table, add `document_reviews` view, and RPC `admin_review_document(doc_id, decision, note)` that:
  - updates `documents.status` (`verified`/`rejected`) + `verified_at`
  - recomputes GigScore and loan eligibility snapshots
  - inserts a notification for the worker
- Rewrite `src/routes/app.admin.tsx` into tabs (Workers | Documents | SOS). Workers table: search, filter by verification/blocked, row actions View / Block / Unblock / Delete. Documents tab: list pending with preview link (signed URL) + Approve/Reject buttons wired to the RPC.
- Server functions: `adminListWorkers`, `adminGetWorker(id)`, `adminSetBlocked`, `adminListPendingDocs`, `adminSignedUrl`, `adminReviewDocument`, `adminDeleteWorker`. All gated by `has_role`.
- Add GigScore recompute function `public.recompute_gigscore(uid)` — deterministic formula (profile completeness 20, verified docs 25, verified work 30, income consistency 15, activity 10). Written to `gigscore_snapshots`. Called from `admin_review_document` and on income insert via trigger.

## 2. Income analytics
- Migration: add `income_sources` table (id, user_id, kind: gig_platform | employer | bank | other, name, external_ref, created_at) with owner RLS.
- "Connect Source" opens a dialog to add a source; existing transactions rows are the income records. New server fns: `listIncomeSources`, `addIncomeSource`, `addIncomeRecord` (writes to `transactions`), `uploadIncomeProof` (stores in `documents` bucket under `<uid>/income/`).
- Recharts wired in `app.income.tsx`: daily (30d), weekly (12w), monthly (12m), yearly (5y), source distribution (pie), growth trend (area). All queries aggregate real `transactions` rows; empty state stays when no data.
- Trigger on `transactions` insert → `recompute_gigscore(user_id)`.

## 3. Maps
- Single reusable `<InteractiveMap>` component (loads Maps JS via existing browser key + `loading=async&callback=initMap`, uses `google.maps.Marker`, no `mapId`).
- `nearbyPlaces` server fn already exists — extend to accept `includedType` values for `gas_station`, `hospital`, `car_repair`, `ev_charging_station`, `restaurant` (rest stops).
- New route `src/routes/app.hospitals.tsx` + add nav entry. Fuel + Mechanics + Rest stops share one route `src/routes/app.services.tsx` with tab switch (keeps sidebar tidy). EV Charging route already exists — upgrade to show the map, ratings, distance, "Navigate" (Google Maps deep link).
- Add `computeRoute` server fn hitting `routes/directions/v2:computeRoutes` for ETA + distance + polyline; used by "Navigate/Route" buttons.
- Autocomplete via Places API (New) `AutocompleteSuggestion.fetchAutocompleteSuggestions` on a destination search box.

## 4. Live location sharing + i18n
- Migration: `location_shares` table (id, sender_id, recipient_id, mode: current|live, latest_lat, latest_lng, started_at, ended_at, active). RLS: sender or recipient can select their own rows; sender can insert/update.
- `src/routes/app.location.tsx` gains a "Share with users" dialog: searches `profiles` by name/email/phone (new `searchWorkers` server fn returning only id/full_name/photo_url/status — no PII beyond that; auth-only). Multi-select recipients, choose Current or Live, submit → inserts share row(s) + notification for each recipient. Live mode refreshes `latest_lat/lng` from `recordLocation`. "Stop sharing" flips `active=false`.
- Recipient sees active shares in dashboard notifications with an "Open in Google Maps" link (`https://www.google.com/maps?q=lat,lng`).
- i18n: expand `src/lib/i18n.tsx` dictionary to all 8 languages for shell + page headers. Store selection in `user_settings.language`; loaded on sign-in, saved on change.

## Technical notes
- All server fns keep `requireSupabaseAuth`; admin fns additionally check `has_role`.
- No new backend runtime — everything is TanStack server functions + Supabase.
- Google Maps stays via existing connector gateway; browser key only for Maps JS + Places autocomplete.
- Recharts already listed as a target dependency; will `bun add recharts` if not installed.
- Migrations are additive — existing tables and RLS remain intact.

## Out of scope for this pass (to keep the build focused)
- Real bank-statement OCR / real government API calls — kept as manual admin verification workflow, as the prompt allows.
- Password reset email flow (Supabase default retained; no `/reset-password` page unless requested).

Ready to proceed — I'll execute in this order: migrations → server fns → admin UI → income UI → maps UI → live share UI → i18n polish → end-to-end smoke test.
