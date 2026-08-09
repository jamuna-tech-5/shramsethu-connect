# ShramSethu — database export for a self-owned Supabase project

Generated from the live ShramSethu database. The current database is untouched.

## Files

| File | Contents |
| --- | --- |
| `0001_shramsethu_schema.sql` | Enum types, all tables (columns, types, defaults, not-null), primary keys, unique + check constraints, foreign keys, indexes, functions, triggers (including the `auth.users` → `handle_new_user` trigger), Data API grants, RLS enablement, all RLS policies, function EXECUTE privileges, the `documents` storage bucket and its object policies. |
| `0002_reference_data.sql` | Optional reference rows (government schemes catalogue). |

No user data (profiles, documents, transactions, scores) is included — schema only.

## Apply to the new project

Easiest: open the new project's **SQL Editor**, paste `0001_shramsethu_schema.sql`, run it, then do the same with `0002_reference_data.sql`.

Via CLI:

```bash
supabase link --project-ref <new-project-ref>
psql "$NEW_DB_URL" -f supabase/export/0001_shramsethu_schema.sql
psql "$NEW_DB_URL" -f supabase/export/0002_reference_data.sql
```

Both scripts are idempotent (`if not exists` / `on conflict do nothing` / policy re-create), so a partial run can be re-run safely.

## After applying

1. **Auth settings** — in the new project enable Email sign-ups with auto-confirm, and configure the Google provider if you use Google sign-in.
2. **Storage** — the `documents` bucket is created private by default; files themselves are not copied.
3. **Admin user** — grant yourself the admin role:
   ```sql
   insert into public.user_roles (user_id, role)
   values ('<your-auth-user-uuid>', 'admin')
   on conflict do nothing;
   ```
4. **Vercel environment variables** (from the new project's API settings):
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (anon), `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `ADMIN_SECRET_CODE`, `SESSION_SECRET` (32+ chars), `GEMINI_API_KEY`
   - `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_BROWSER_KEY` (optional; Leaflet/OSM fallback works without them)