# QCL Project Manager — Technical Documentation

## What This App Is

A Next.js 16 web app for managing lead generation client accounts for Executive Roundtable (ERT) events. Tracks clients, VA assignments, ERT attendance confirmations, performance metrics, personal tasks, and meeting notes. Includes an AI-powered command bar (Claude Sonnet 4.6) and integrations with Monday.com, Google Calendar, and Gmail.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| UI | React 19.2.4 |
| Language | TypeScript 5.x |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Styling | Inline CSS objects (no CSS framework) |
| Package manager | npm |

**Important:** This project uses Next.js 16 (not 13/14/15). APIs and conventions differ. Always check `node_modules/next/dist/docs/` before writing Next.js-specific code.

---

## Project Structure

```
qcl-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # Renders <Dashboard />
│   ├── globals.css
│   └── api/
│       ├── clients/
│       │   ├── route.ts                # GET all, POST new
│       │   └── [id]/route.ts           # PUT update, DELETE
│       ├── attendance/
│       │   ├── route.ts                # GET all, POST new
│       │   └── [id]/route.ts           # DELETE
│       ├── tasks/
│       │   ├── route.ts                # GET all, POST new
│       │   └── [id]/route.ts           # PATCH update, DELETE
│       ├── meeting-draft/
│       │   └── route.ts                # GET current draft, PUT save
│       ├── monday/
│       │   ├── post/route.ts           # POST note to client board or MCL
│       │   ├── roundtable/route.ts     # GET roundtable status from Monday
│       │   └── activity/route.ts       # GET client activity tracking from Monday
│       ├── calendar/
│       │   └── events/route.ts         # POST create Google Calendar event
│       ├── gmail/
│       │   ├── threads/route.ts        # GET inbox threads
│       │   ├── draft/route.ts          # POST save to Gmail drafts
│       │   └── send/route.ts           # POST send email
│       ├── auth/
│       │   ├── google/route.ts         # GET initiate OAuth
│       │   └── callback/route.ts       # GET handle OAuth callback
│       ├── prefs/route.ts              # GET/POST AI memory/preferences
│       ├── kb/route.ts                 # GET/POST AI knowledge base
│       └── claude/route.ts             # POST proxy to Anthropic API
├── components/
│   ├── Dashboard.tsx                   # Root: state, tabs, modals
│   ├── Overview.tsx                    # Tab 1: ERTs, Calendar, Inbox, Tasks, Meeting Draft
│   ├── Clients.tsx                     # Tab 2: searchable client table (attendees from Monday)
│   ├── RoundtableTab.tsx               # Tab 3: roundtable status from Monday
│   ├── VAsTab.tsx                      # Tab 4: VA attendance & strike tracker
│   ├── MondayActivity.tsx              # Tab 5: client activity tracking from Monday
│   ├── CalendarPanel.tsx               # Google Calendar events panel
│   ├── InboxPanel.tsx                  # Gmail inbox panel
│   ├── TaskPanel.tsx                   # Personal task list panel
│   ├── MeetingDraftPanel.tsx           # Meeting notes & action items panel
│   ├── Detail.tsx                      # Client detail modal (notes + Monday post buttons)
│   ├── ClientForm.tsx                  # Create/edit client form
│   ├── AttForm.tsx                     # Log attendance entry form
│   ├── QuickBar.tsx                    # AI assistant panel (Claude)
│   └── ui.tsx                          # Shared primitives
├── lib/
│   ├── db.ts                           # SQLite CRUD (all DB calls)
│   ├── monday.ts                       # Monday.com API helpers
│   ├── utils.ts                        # uid, fmt, tsNow, fuzzyMatch, etc.
│   └── constants.ts                    # VAS[], STATUSES[], DARK{}, LIGHT{}
├── types/index.ts                      # TypeScript interfaces
├── data/qcl.db                         # SQLite database
├── .env.local                          # Secret keys (never commit)
└── next.config.ts                      # serverExternalPackages: ["better-sqlite3"]
```

---

## Database Schema

Database file: `data/qcl.db` — SQLite with WAL mode.

### Table: `clients`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | `uid()` |
| name | TEXT NOT NULL | |
| email | TEXT | |
| va | TEXT | One of VAS[] |
| start | TEXT | YYYY-MM |
| status | TEXT | One of STATUSES[] |
| li | TEXT | 'Active' / 'Inactive' / 'Not Eligible' |
| ert | TEXT | YYYY-MM-DD |
| ert_time | TEXT | e.g. "2:00 PM EST" |
| attendees | INTEGER | Confirmed (target: 20) — legacy/fallback; live value comes from Monday roundtable |
| registered | INTEGER | Total registered |
| message | TEXT | Outreach message |
| targeting | TEXT | Targeting filters |
| flag | TEXT | Issue note |
| notes | TEXT | JSON: `Note[]` stringified |
| sort_order | INTEGER | Custom row ordering |
| redzone | INTEGER | 0/1 boolean flag |

### Table: `attendance`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| va | TEXT NOT NULL | |
| date | TEXT NOT NULL | YYYY-MM-DD |
| late | INTEGER | 1 = late |
| absent | INTEGER | 1 = absent |
| ooz | INTEGER | 1 = out of Zoom |
| notes | TEXT | |

### Table: `tasks`

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| text | TEXT NOT NULL | |
| done | INTEGER | 0/1 |
| due_date | TEXT | YYYY-MM-DD |
| priority | TEXT | 'normal' / 'important' / 'urgent' |
| ts | TEXT | Created timestamp (en-GB) |

### Table: `meeting_draft`

Single row (`id = 'current'`). Persists one active meeting draft.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | Always 'current' |
| client_id | TEXT | FK to clients.id |
| client_name | TEXT | Denormalized for display |
| notes | TEXT | Free-form meeting notes |
| action_items | TEXT | JSON: `MeetingActionItem[]` |
| updated_at | TEXT | Last save timestamp |

### Table: `settings`

Key-value store for feature flags and one-time seeds.

---

## TypeScript Types (`types/index.ts`)

```typescript
interface Note {
  id: string;
  type: 'gen' | 'upd' | 'ai';
  text: string;
  ts: string;                       // "DD MMM YY HH:mm"
  title?: string;
}

interface Client {
  id: string; name: string; email: string; va: string; start: string;
  status: string; li: string; ert: string; ertTime: string;
  attendees: number; registered: number; message: string;
  targeting: string; flag: string; redzone: boolean; notes: Note[];
}

interface Task {
  id: string; text: string; done: boolean;
  dueDate: string; priority: 'normal' | 'important' | 'urgent'; ts: string;
}

interface MeetingActionItem {
  id: string; text: string; done: boolean;
}

interface MeetingDraft {
  clientId: string; clientName: string;
  notes: string; actionItems: MeetingActionItem[]; updatedAt: string;
}

interface RoundtableEvent {
  clientName: string; date: string; rtTime: string;
  attendees: number | null; registered: number | null; calendarConfirmed: number | null;
}

interface AttendanceEntry {
  id: string; va: string; date: string;
  late: boolean; absent: boolean; ooz: boolean; notes: string;
}
```

---

## API Routes

### Clients
- `GET /api/clients` → `Client[]` — **auto-updates status before returning**: any client with `attendees < 15` whose status is `"Performing"` is silently updated to `"Slow Generating"` in the DB. `"At Risk"` and `"Stopped"` are never auto-changed.
- `POST /api/clients` `{ ...fields, note? }` → `Client`
- `PUT /api/clients/[id]` `{ ...Partial<Client>, notesToAppend?, notesReplace? }` → `Client`
- `DELETE /api/clients/[id]` → `{ ok: true }`

### Attendance
- `GET /api/attendance` → `AttendanceEntry[]`
- `POST /api/attendance` → `AttendanceEntry`
- `DELETE /api/attendance/[id]` → `{ ok: true }`

### Tasks
- `GET /api/tasks` → `Task[]` (active first, newest first)
- `POST /api/tasks` `{ text, dueDate?, priority? }` → `Task`
- `PATCH /api/tasks/[id]` `{ done?, text?, dueDate?, priority? }` → `Task`
- `DELETE /api/tasks/[id]` → `{ ok: true }`

### Meeting Draft
- `GET /api/meeting-draft` → `MeetingDraft`
- `PUT /api/meeting-draft` `Partial<MeetingDraft>` → `MeetingDraft` (partial update)

### Monday.com
- `POST /api/monday/post` `{ clientName, noteText, target: "client"|"mcl" }` → `{ ok, bubble?, error? }`
- `GET /api/monday/roundtable` → `{ boardName, events: RoundtableEvent[] }`
- `GET /api/monday/activity` → `{ boardName, rows: ActivityRow[] }`

### Google Calendar
- `POST /api/calendar/events` `{ title, date, startTime?, endTime?, allDay?, location? }` → `{ ok, eventId? }`

### Gmail
- `GET /api/gmail/threads` → `GmailThread[]`
- `POST /api/gmail/draft` `{ to, subject, body }` → `{ ok }`
- `POST /api/gmail/send` `{ to, subject, body }` → `{ ok }`

### Auth
- `GET /api/auth/google` → redirect to Google OAuth
- `GET /api/auth/callback` → handles OAuth callback, stores tokens

### AI
- `POST /api/claude` `{ payload: MessageRequest }` → raw Anthropic API response
- `GET /api/prefs` → `Record<string, string>` (AI memory)
- `POST /api/prefs` `{ key, value }` → `{ prefs }` (value = null to delete)
- `GET /api/kb` → `{ text: string }`
- `POST /api/kb` `{ text }` → `{ ok }`

---

## Components

### Dashboard (`Dashboard.tsx`)
Root stateful component. Owns: `clients`, `attendance`, `rtData` (Monday roundtable cache), tab state, modals.

Roundtable data is fetched once and cached — passed to both `RoundtableTab` and `Clients` to avoid re-fetching on tab switches.

### Overview (`Overview.tsx`)
Two-column layout:
- **Left**: Upcoming ERTs table + TaskPanel (stacked)
- **Right**: CalendarPanel | (InboxPanel + MeetingDraftPanel stacked)

### Clients (`Clients.tsx`)
Searchable/filterable table. Attendees column is computed live from Monday roundtable data (`rtData` prop) — falls back to stored value if Monday hasn't loaded.

### RoundtableTab (`RoundtableTab.tsx`)
Reads from Monday roundtable board. Groups events per client. Accepts `data/loading/error/onLoad` props from Dashboard (no internal fetch — data is shared/cached at Dashboard level).

### MondayActivity (`MondayActivity.tsx`)
Reads from Monday activity tracking board. Collapsible rows per client showing outreach metrics: connection requests, LI invites, inmails, connections made.

### TaskPanel (`TaskPanel.tsx`)
Personal task list. Filter: Active / Done. Priority cycling: normal (☆) → important (★) → urgent (!!). Listens for `task-refresh` custom event. Accent: amber.

### MeetingDraftPanel (`MeetingDraftPanel.tsx`)
Persisted meeting scratchpad (single active draft). Two sections: free-form notes + action items checklist. Auto-saves to DB 800ms after any change.
- **Save as note** → appends full draft to selected client's notes
- **Push to tasks** → creates tasks from unchecked items prefixed with client name (e.g. "Mike Brown - call him tomorrow")
- **Clear** → resets draft after confirmation
Accent: `#06b6d4` (cyan).

### CalendarPanel (`CalendarPanel.tsx`)
Shows upcoming Google Calendar events. Connects via OAuth.

### InboxPanel (`InboxPanel.tsx`)
Shows recent Gmail threads. Connects via OAuth.

### Detail (`Detail.tsx`)
Client detail modal. Each note has two Monday post buttons: **Board** (client's own board) and **MCL** (Master Client List). AI classifies which bubble to post in (Scheduling / Messaging / Targeting / etc.). Results shown inline.

### QuickBar (`QuickBar.tsx`)
AI assistant side panel (Claude Sonnet 4.6). Supports multi-turn conversation. Has a KB editor for custom rules/SOPs. Supported actions:

| Action | What it does |
|---|---|
| `open_client` | Opens client detail modal |
| `update_client` | Updates fields (attendees, status, ERT, flag, VA, etc.) |
| `add_note` | Adds a note to a client |
| `schedule_meeting` | Logs meeting reminder + shows popup |
| `multi_update` | Updates multiple clients at once |
| `create_calendar_event` | Creates Google Calendar event (handles timezone → Cairo) |
| `draft_email` | Composes email with send/draft/Gmail options |
| `post_to_monday` | Posts to client's Monday board |
| `add_task` | Adds item to personal task list |
| `save_preference` / `forget_preference` | Manages AI memory |
| `show_*` | Tab navigation |
| `summary` | Answers data questions |

---

## Constants (`lib/constants.ts`)

```typescript
VAS = ["Claire", "Rosalie", "Aliah", "Arvi", "Peevee"]

STATUSES = ["New Client", "Performing", "Slow Generating", "At Risk", "Stopped"]
```

VA chip colors: Claire=red, Rosalie=purple, Aliah=amber, Arvi=blue, Peevee=green.

---

## Environment Variables (`.env.local` — never commit)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI (QuickBar) |
| `MONDAY_API_TOKEN` | Monday.com GraphQL API |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL |
| `GOOGLE_CALENDAR_ICAL_URL` | Calendar iCal feed URL |

---

## Visual Design System

### Fonts (loaded via `globals.css` @import)
| Font | Use |
|---|---|
| **Inter** | Body + UI (primary font, set on `body` and Dashboard outer div) |
| **Syne** | Display headings (header title, section titles) |
| **JetBrains Mono** | Data/numbers (dates in header, LIVE badge, AI badge, stats) — apply via `.qcl-num` class or `fontFamily: "'JetBrains Mono', monospace"` |
| **Sora** | Legacy (still loaded; some sub-components use it explicitly) |

### Dark Palette (`lib/constants.ts` → `DARK`)
| Token | Value | Use |
|---|---|---|
| `bg` | `#060810` | Page background |
| `bg2` | `#090d1c` | Slightly elevated surfaces |
| `bg3` | `#0f1628` | Panels, cards |
| `border` | `#111d36` | Default borders |
| `border2` | `#1c2f50` | Hover/focus borders |
| `text` | `#e2eaf8` | Primary text |
| `muted` | `#4a6080` | Secondary text |

### Dashboard Shell (`Dashboard.tsx`)
- **Background**: `#060810` solid (dark) / `#f4f6fb` (light). No radial gradient on outer div.
- **Ambient blobs**: 3 absolutely-fixed `<div>` elements (`.qcl-blob-1/2/3`) rendered only in dark mode. Large blurred radial gradients (cyan, violet, blue) with slow CSS float animations. Defined in `globals.css`.
- **Grain overlay**: `.qcl-grain::after` — animated SVG noise, opacity 0.018.
- **Accent bar**: 2px rainbow gradient at top (cyan → emerald → blue → orange → violet).
- **Header**: `height: 57`, sticky top-0 z-20, deep glass (`rgba(6,8,16,0.88)` + `blur(28px)`). Contains: hexagon logo mark (SVG gradient), Syne title with gradient text, JetBrains Mono date, AI badge, LIVE status indicator (dark mode only), theme toggle, Add client button.
- **Nav**: sticky `top: 57`, z-19, deeper glass. Tab pills unchanged (pill shape, per-tab accent color glow on active).
- **Content**: `padding: "24px 28px 8px"`, `position: "relative"`, `zIndex: 1`.

### Tab Accent Colors
| Tab | Color |
|---|---|
| Overview | `#06b6d4` (cyan) |
| All Clients | `#10b981` (emerald) |
| Roundtable Status | `#4ba3ff` (blue) |
| Client Activity | `#f97316` (orange) |
| VA Tracker | `#8b5cf6` (violet) |

### CSS Classes (`globals.css`)
| Class | Purpose |
|---|---|
| `.qcl-grain` | Applies animated noise texture via `::after` pseudo-element |
| `.qcl-blob-1/2/3` | Fixed ambient light blobs (dark mode) with float animations |
| `.qcl-tab` | Tab button transition (cubic-bezier spring) |
| `.qcl-tab-content` | Fade-up animation on tab switch |
| `.qcl-num` | JetBrains Mono for data/stat numbers |
| `.qcl-row` | Table row with hover highlight |
| `.qcl-card` | Card hover effect |
| `.qcl-btn` | Button transitions |
| `.qcl-inp` | Input focus ring |
| `.ai-orb` | AI button pulse animation |

---

## Key Patterns

- **All DB access goes through `lib/db.ts`** — never import `better-sqlite3` directly elsewhere.
- **No ORM** — raw SQL via prepared statements.
- **No CSS framework** — all styling is inline JS objects using `D` from `useTheme()`.
- **No global state library** — all state in `Dashboard.tsx`, passed as props. Data flows down, callbacks flow up.
- **Roundtable data is cached at Dashboard level** — fetched once, passed as props to avoid re-fetching on tab switches.
- **Notes stored as JSON** in `clients.notes` column, parsed in `db.ts`.
- **Custom DOM events** (`task-refresh`, `cal-refresh`) used for cross-component refresh without prop drilling.
- **Monday.com pagination** — per-group cursor pagination used to bypass 500-item board-level cap.
- **Exact board name matching** for MCL — uses `b.name.toLowerCase() === "master client list"` (not fuzzy) to avoid matching similar board names.
- **`next.config.ts`** must keep `serverExternalPackages: ["better-sqlite3"]`.

---

## Running the App

```bash
npm install       # first time only
npm run dev       # → http://localhost:3000
npm run build
npm run start
```

## Direct DB Access

```bash
sqlite3 -column -header data/qcl.db "SELECT name, va, status, ert FROM clients WHERE status != 'Stopped';"
sqlite3 -column -header data/qcl.db "SELECT * FROM tasks WHERE done = 0;"
```
