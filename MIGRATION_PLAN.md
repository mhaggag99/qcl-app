# QCL App — Multi-User Migration Plan

## Goal

Turn the current single-user personal tool into a shared team app where:
- Each team member logs in with their own account
- Each user connects their own Monday.com API key and Google account
- All existing data (clients, tasks, attendance, etc.) is migrated to the owner's account
- New users start with a completely empty workspace

---

## Before you start — back up your database

Run this once before making any code changes:

```bash
cp data/qcl.db data/qcl.db.backup
```

If anything goes wrong during the migration, restore with:

```bash
cp data/qcl.db.backup data/qcl.db
```

The `.backup` file is a complete snapshot of all your clients, tasks, attendance, and everything else. Keep it until you've confirmed the migration worked correctly and all your data appears under your new account.

---

## Tech choices

| Concern | Solution |
|---|---|
| Password hashing | `bcryptjs` |
| Session tokens | `jose` (JWT in httpOnly cookie) |
| Auth storage | Own `users` table in SQLite |
| Per-user API keys | `user_settings` table in SQLite |
| No third-party auth | No Clerk, no NextAuth |

---

## Phase 1 — Install dependencies ✅

```bash
npm install bcryptjs jose
npm install --save-dev @types/bcryptjs
```

---

## Phase 2 — Database: new tables + add `user_id` to all existing tables ✅

### 2a. New tables to add in `lib/db.ts` `initSchema()`

**`users`** — one row per team member
```sql
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  created_at  TEXT NOT NULL
);
```

**`user_settings`** — per-user API keys and tokens
```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id             TEXT PRIMARY KEY,
  monday_api_token    TEXT DEFAULT '',
  google_access_token  TEXT DEFAULT '',
  google_refresh_token TEXT DEFAULT '',
  google_token_expiry  TEXT DEFAULT ''
);
```

### 2b. Add `user_id` column to every existing table

Run these once as a migration (check column doesn't exist first):
```sql
ALTER TABLE clients      ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks        ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance   ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE activity_log ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE monday_seen  ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
```

**`meeting_draft`** — currently a single global row (`id = 'current'`). Change so each user has their own draft row. New PK becomes `user_id` instead of the hardcoded `'current'`.
```sql
-- Rename old table, recreate with user_id as PK
CREATE TABLE IF NOT EXISTS meeting_draft_v2 (
  user_id       TEXT PRIMARY KEY,
  client_id     TEXT DEFAULT '',
  client_name   TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  action_items  TEXT DEFAULT '[]',
  updated_at    TEXT DEFAULT ''
);
```

---

## Phase 3 — Data migration: move existing data to the owner account ✅

This runs **once**, when the owner creates the first account (role = `'owner'`).

After the owner registers, a migration script sets `user_id` on all rows that still have the default empty string:

```sql
UPDATE clients       SET user_id = '<owner_user_id>' WHERE user_id = '';
UPDATE tasks         SET user_id = '<owner_user_id>' WHERE user_id = '';
UPDATE attendance    SET user_id = '<owner_user_id>' WHERE user_id = '';
UPDATE activity_log  SET user_id = '<owner_user_id>' WHERE user_id = '';
UPDATE monday_seen   SET user_id = '<owner_user_id>' WHERE user_id = '';
INSERT INTO meeting_draft_v2 SELECT '<owner_user_id>', client_id, client_name, notes, action_items, updated_at FROM meeting_draft WHERE id = 'current';
```

This migration is triggered automatically on first registration (when `users` table is empty before insert).

---

## Phase 4 — Auth library (`lib/auth.ts`) ✅

New file. Handles:
- `hashPassword(plain)` → bcrypt hash
- `verifyPassword(plain, hash)` → boolean
- `signToken(payload)` → signed JWT string (24h expiry)
- `verifyToken(token)` → decoded payload `{ userId, email, role }` or null
- `getSessionUser(request)` → reads `qcl_token` cookie, verifies, returns user payload or null

Cookie name: `qcl_token`, httpOnly, Secure, SameSite=Lax, 24h maxAge.

---

## Phase 5 — New API routes ✅

### `POST /api/auth/register`
- Body: `{ email, password, name }`
- Only allowed when `users` table is empty (first user = owner) OR by an existing owner
- Hashes password, inserts into `users`, runs data migration if this is the first user
- Returns `{ ok: true }`

### `POST /api/auth/login`
- Body: `{ email, password }`
- Looks up user by email, verifies password hash
- On success: signs JWT, sets `qcl_token` httpOnly cookie, returns `{ user: { id, email, name, role } }`
- On failure: returns `401`

### `POST /api/auth/logout`
- Clears `qcl_token` cookie
- Returns `{ ok: true }`

### `GET /api/auth/me`
- Reads cookie, verifies token
- Returns `{ user: { id, email, name, role } }` or `401`

---

## Phase 6 — Middleware (`middleware.ts`) ✅

Protects all routes. Logic:
- If path is `/login` or `/api/auth/*` → allow through (public)
- Otherwise: read `qcl_token` cookie, verify JWT
  - Valid → allow through
  - Invalid/missing → redirect to `/login` (for page routes) or return `401` (for `/api/*`)

```
Protected paths:  everything except /login and /api/auth/*
```

---

## Phase 7 — Update `lib/db.ts` ✅

Every function that reads or writes data needs a `userId: string` parameter added. The `userId` is used as a `WHERE user_id = ?` filter on reads and included in inserts.

Functions to update:

| Function | Change |
|---|---|
| `getClients(userId)` | Add `WHERE user_id = ?` |
| `createClient(data, userId)` | Insert with `user_id` |
| `updateClient(id, data, userId)` | Add `AND user_id = ?` to WHERE |
| `deleteClient(id, userId)` | Add `AND user_id = ?` to WHERE |
| `getTasks(userId)` | Add `WHERE user_id = ?` |
| `createTask(data, userId)` | Insert with `user_id` |
| `updateTask(id, data, userId)` | Add `AND user_id = ?` |
| `deleteTask(id, userId)` | Add `AND user_id = ?` |
| `getAttendance(userId)` | Add `WHERE user_id = ?` |
| `createAttendance(data, userId)` | Insert with `user_id` |
| `deleteAttendance(id, userId)` | Add `AND user_id = ?` |
| `getActivityLogs(userId)` | Add `WHERE user_id = ?` |
| `createActivityLog(data, userId)` | Insert with `user_id` |
| `getMeetingDraft(userId)` | Use `WHERE user_id = ?` (new schema) |
| `saveMeetingDraft(data, userId)` | Upsert by `user_id` |
| `getSeenNotifications(userId)` | Add `WHERE user_id = ?` |
| `markNotificationSeen(id, userId)` | Insert with `user_id` |

New functions to add:

| Function | Purpose |
|---|---|
| `createUser(email, passwordHash, name, role)` | Insert into `users` |
| `getUserByEmail(email)` | Look up user for login |
| `getUserById(id)` | Look up user by ID |
| `getUserSettings(userId)` | Get Monday token + Google tokens |
| `saveUserSettings(userId, settings)` | Upsert user's API keys/tokens |
| `countUsers()` | Check if any users exist (for first-run) |
| `migrateDataToOwner(userId)` | Bulk UPDATE all legacy rows to owner |

---

## Phase 8 — Update all API routes ✅

Every API route needs to:
1. Call `getSessionUser(request)` from `lib/auth.ts`
2. Return `401` if no valid session
3. Pass `user.userId` to every `db.*` call
4. Apply feature gating where relevant (see table below)

### Feature gating per route group

| Route group | Guard check | Response if not configured |
|---|---|---|
| Monday routes (`/api/monday/*`) | `getUserSettings(userId).monday_api_token` is non-empty | `{ error: "monday_not_configured" }` |
| Google routes (`/api/gmail/*`, `/api/calendar/*`) | `process.env.GOOGLE_CLIENT_ID` is set AND user has `google_access_token` | `{ error: "google_not_configured" }` or `{ error: "google_not_connected" }` |
| AI route (`/api/claude`) | `process.env.ANTHROPIC_API_KEY` is set | `{ error: "ai_not_configured" }` |

### Routes to update
- `app/api/clients/route.ts` and `[id]/route.ts`
- `app/api/tasks/route.ts` and `[id]/route.ts`
- `app/api/attendance/route.ts` and `[id]/route.ts`
- `app/api/meeting-draft/route.ts`
- `app/api/monday/post/route.ts` — read Monday token from `getUserSettings(userId)`; gate if missing
- `app/api/monday/roundtable/route.ts` — same
- `app/api/monday/activity/route.ts` — same
- `app/api/monday/mentions/route.ts` — same
- `app/api/calendar/events/route.ts` — read Google tokens from `getUserSettings(userId)`; gate if missing
- `app/api/gmail/threads/route.ts` — same
- `app/api/gmail/draft/route.ts` — same
- `app/api/gmail/send/route.ts` — same
- `app/api/auth/google/route.ts` — gate if `GOOGLE_CLIENT_ID` missing; store tokens to `user_settings` on callback
- `app/api/auth/callback/route.ts` — same
- `app/api/prefs/route.ts`
- `app/api/kb/route.ts`
- `app/api/claude/route.ts` — gate if `ANTHROPIC_API_KEY` missing

---

## Phase 9 — New frontend pages ✅

### `/login` page (`app/login/page.tsx`)
- Simple email + password form
- Calls `POST /api/auth/login`
- On success: redirect to `/`
- Styled to match the existing dark theme

### User Settings page or modal
- Let each user enter their own Monday.com API token
  - If left empty, all Monday features (Roundtable, Activity, Mentions, posting notes) are hidden/disabled for that user
- Button to connect Google account (triggers OAuth flow)
  - Only shown if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present in `.env.local` — if the server owner hasn't set them, the Google section is hidden entirely for all users
  - If the server owner has set them but the user hasn't connected yet, Calendar and Gmail panels show a "Connect Google" prompt instead of data
- Saves to `user_settings` table via new `PUT /api/user/settings` route
- Accessible from a settings icon in the Dashboard header

---

## Phase 10 — Update frontend components ✅

### `Dashboard.tsx`
- On mount: call `GET /api/auth/me` to get current user
- Pass `user` object down as prop where needed
- Add logout button + user name display in the header
- Add link to user settings

### No other components need structural changes
- Data comes from API routes, which are now user-scoped — components just render what they receive

---

## Phase 11 — API key ownership model ✅

### Per-user (stored in `user_settings` DB table)

These are different for every team member. Each user sets them in their own Settings page.

| Key | Where it moves | Feature disabled if missing |
|---|---|---|
| `MONDAY_API_TOKEN` | `user_settings.monday_api_token` | Roundtable, Activity, Mentions, post-to-Monday buttons |
| Google access token | `user_settings.google_access_token` | Calendar panel, Gmail inbox |
| Google refresh token | `user_settings.google_refresh_token` | (same) |

### App-level (stay in `.env.local`)

These are set once by whoever runs the server. They are shared across all users.

| Key | Purpose | Feature disabled if missing |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude AI (QuickBar) | AI assistant panel |
| `GOOGLE_CLIENT_ID` | Google OAuth app registration | Google features hidden for ALL users |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app registration | Google features hidden for ALL users |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL | Google features hidden for ALL users |
| `JWT_SECRET` | Signs session tokens | **Required — app won't work without it** |

### Feature gating rules

- **Monday features**: Each API route that calls Monday checks `getUserSettings(userId).monday_api_token`. If empty → returns `{ error: "monday_not_configured" }`. Frontend panels show a "Add your Monday API token in Settings" message instead of data.
- **Google features**: Middleware/route checks `process.env.GOOGLE_CLIENT_ID` first. If missing → returns `{ error: "google_not_configured" }`. Frontend panels check this flag on load and hide the Connect button entirely. If CLIENT_ID is set but user has no token → show "Connect Google" prompt.
- **AI (QuickBar)**: If `ANTHROPIC_API_KEY` missing → QuickBar shows "AI not available" and disables send.

### What to remove from `.env.local`

```
# Remove these (move to user_settings):
MONDAY_API_TOKEN
GOOGLE_CALENDAR_ICAL_URL

# Keep these (app-level):
ANTHROPIC_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI

# Add this (new):
JWT_SECRET=<random 32+ char string>
```

---

## Phase 12 — Hosting (Railway)

1. Push repo to GitHub
2. Create new Railway project → connect GitHub repo
3. Add a **Volume** mounted at `/app/data` so `data/qcl.db` survives redeploys
4. Set all environment variables in Railway dashboard (the ones that remain in `.env.local`)
5. Railway auto-detects Next.js and runs `npm run build && npm run start`

No SQLite → Postgres migration needed for a small team (under ~20 users, low concurrent writes). Can be done later if needed.

---

## Implementation order

```
Phase 1  → Install packages                          ✅ DONE
Phase 2  → DB schema changes                         ✅ DONE
Phase 4  → lib/auth.ts                               ✅ DONE
Phase 5  → Auth API routes                           ✅ DONE
Phase 6  → Middleware                                ✅ DONE
Phase 3  → Data migration logic (triggered from register route) ✅ DONE
Phase 7  → Update lib/db.ts                          ✅ DONE
Phase 8  → Update all API routes                     ✅ DONE
Phase 9  → Login page + Settings page                ✅ DONE
Phase 10 → Dashboard updates                         ✅ DONE
Phase 11 → Clean up .env.local                      ✅ DONE
Phase 12 → Deploy to Railway
```

---

## Files created / modified summary

### New files
- `lib/auth.ts`
- `middleware.ts`
- `app/login/page.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/user/settings/route.ts`

### Modified files
- `lib/db.ts` — new tables, new functions, userId on all existing functions
- `components/Dashboard.tsx` — auth state, user display, logout
- `app/api/clients/route.ts` + `[id]/route.ts`
- `app/api/tasks/route.ts` + `[id]/route.ts`
- `app/api/attendance/route.ts` + `[id]/route.ts`
- `app/api/meeting-draft/route.ts`
- `app/api/monday/post/route.ts`
- `app/api/monday/roundtable/route.ts`
- `app/api/monday/activity/route.ts`
- `app/api/monday/mentions/route.ts`
- `app/api/calendar/events/route.ts`
- `app/api/gmail/threads/route.ts`
- `app/api/gmail/draft/route.ts`
- `app/api/gmail/send/route.ts`
- `app/api/auth/google/route.ts`
- `app/api/auth/callback/route.ts`
- `app/api/prefs/route.ts`
- `app/api/kb/route.ts`
- `app/api/claude/route.ts`
- `.env.local` — add `JWT_SECRET`, remove `MONDAY_API_TOKEN`
- `TECHNICAL.md` — update schema, routes, components docs
