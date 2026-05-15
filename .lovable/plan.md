
# Plan — Scanner app side of the workers source-of-truth fix

Most of this request lives in the **owner dashboard (barberflow)** project: new `workers` table, manual worker creation form, daily QR token table tied to `worker_id`, and updated `validate-scan` / `get-attendance-history` edge functions. That work needs to be done in that project, not here.

This plan covers only the **Scanner app** changes required so it works correctly once the backend is the single source of truth.

## What changes in this project

### 1. `src/pages/History.tsx`
- Stop sending `?worker_id=${user.id}` to `get-attendance-history`. The scanner's `user.id` is a Scanner-project auth UUID and has no meaning in barberflow.
- Call the function with **only the Authorization header**. The barberflow function will resolve the worker from the JWT email → `workers` table.
- Read the response shape:
  ```ts
  { staffName: string, workerId: string, logs: Array<{
      id, status, scanned_at, worker_name, worker_id
  }> }
  ```
- Display per-record `worker_name` and `worker_id` (short UUID) under each check-in / check-out time, replacing the current `staff_name` field.
- Show the resolved `staffName` + `workerId` in the header.
- Surface backend errors via toast (`"Worker not registered"`, `"No worker linked to this email"`, etc.) instead of silent `console.error`.
- Re-fetch on `window` focus so a fresh scan appears immediately.

### 2. `src/pages/Scan.tsx`
- Keep current flow (send `qr_session_id` + Authorization header). No `worker_id` is ever sent from the client.
- On success, also accept the new fields the backend will return: `worker_name`, `worker_id`, `status` (CHECKED_IN / CHECKED_OUT / LATE / INVALID).
- Pass them into `SuccessOverlay` so the confirmation screen shows **the real worker name and UUID** that the backend resolved — making the identity link visible to the user.
- On any error from backend (`token expired`, `token reused`, `worker not found`, `wrong day`), show the exact `result.error` in the destructive toast.

### 3. `src/components/SuccessOverlay.tsx`
- Add optional props: `workerName?`, `workerId?`, `status?`.
- Render them under the timestamp when present. No restyle.

### 4. Nothing else changes
- `useAuth`, `staff_profiles`, this project's `qr_sessions` / `attendance_logs` / `scan-qr` edge function are **not touched**. They remain the local Scanner auth layer used only to gate access to the app.
- No migrations in this project.
- Theme, navigation, and all other pages stay as-is.

## Companion prompt for the owner dashboard (barberflow)

Send this to barberflow so the two sides match:

> Create a `workers` table (`id uuid pk`, `name text`, `email text unique`, `status text default 'active'`, `created_at timestamptz default now()`). Add an admin form on the owner dashboard to manually create workers — accept an optional manually-entered UUID (validate it's a UUID and unique, otherwise auto-generate). Seed the 10 workers listed by the user with their exact UUIDs and names.
>
> Create/adjust a `qr_tokens` table: `id`, `worker_id` (fk → workers.id), `token`, `date`, `expires_at`, `used_at`. One token = one worker = one day. Reject expired/reused/wrong-day tokens.
>
> Update `validate-scan` edge function: accept `{ qr_session_id }` + JWT, look up the token, resolve `worker_id` → `workers` row, insert into `attendance_logs` with the workers.id as `staff_id`, return `{ success, timestamp, worker_name, worker_id, status }`.
>
> Update `get-attendance-history`: ignore any `worker_id` query param. Read `email` from the JWT claims, find the worker via `workers.email`, return `{ staffName, workerId, logs: [{ id, status, scanned_at, worker_name, worker_id }] }`. 404 with a clear error if no worker matches.
>
> Both functions: `verify_jwt = false`, validate via `getClaims(token)`, use `npm:@supabase/supabase-js@2`, delete `deno.lock` before redeploy, standard CORS.

## Technical details

- Cross-project auth: barberflow continues to read the Scanner JWT (`email` claim is enough — no signature verification needed for an email lookup, but `getClaims` is preferred for safety).
- Security: scanner can no longer impersonate another worker by tampering with a query param — the worker is derived from the verified email.
- Backwards compatibility: the old `staff_name` field on logs becomes `worker_name`; History will read `log.worker_name ?? log.staff_name` during the brief transition so nothing breaks if barberflow ships slightly later.
