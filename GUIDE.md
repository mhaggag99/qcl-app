# QCL App — Your Guide

## What Is This App?

This is your **QCL Project Manager** — a private web app that runs on your computer. It helps you manage your lead generation clients for Executive Roundtable (ERT) events.

With it you can:
- Track all your clients (status, VA assigned, next ERT date, attendees confirmed, etc.)
- See at a glance which clients need urgent attention
- Track your virtual assistants' attendance (lates, absences, out-of-zoom)
- Keep a personal task list and meeting notes
- View your Google Calendar and Gmail inbox on the dashboard
- Use plain English to update data, create tasks, draft emails, and more via the AI assistant

---

## How to Start the App

1. Open **Terminal** (press `Cmd + Space`, type "Terminal", press Enter)
2. Type this and press Enter:
   ```
   cd ~/Downloads/qcl-app
   ```
3. Then type this and press Enter:
   ```
   npm run dev
   ```
4. Open your browser and go to: **http://localhost:3000**
5. You will be taken to the **Sign in** page — log in with your email and password.

Leave the Terminal window open while you use the app — closing it will stop the app.

---

## How to Stop the App

Go back to the Terminal window and press **Ctrl + C**.

---

## First-Time Setup (Owner Account)

The very first time you open the app, the database has no users. You need to create the **owner account** — this is your personal account and it also migrates all your existing data (clients, tasks, attendance, etc.) to your profile.

1. Open **http://localhost:3000/api/auth/register** in your browser and send a POST request — or use any HTTP tool.
   **Or** — a simpler way: the developer (Claude) can run the registration for you with one command.

   The easiest approach: ask in a Claude Code session:
   ```
   Register me as owner with email YOU@EMAIL.COM and password YOURPASSWORD
   ```
   Claude will hit the register endpoint and confirm when done.

2. Once registered, go to **http://localhost:3000** and log in with your email and password.
3. All your existing data will appear under your account automatically — nothing is lost.

**Adding a colleague:** Use the Admin Panel (see below) to create new team member accounts. New team members get their own empty workspace — they will not see your clients or data.

---

## Signing In and Out

- Go to **http://localhost:3000** — you'll be redirected to the sign-in page automatically if you're not logged in.
- Enter your email and password and click **Sign in**.
- To sign out, click **Sign out** in the top-right corner of the dashboard header.
- Sessions last 24 hours. After that you'll be asked to sign in again.

---

## Connecting Your Integrations (Settings)

Each team member connects their own Monday.com API token and Google account. Nothing is shared between accounts.

**To open Settings:** click the **⚙** (gear) icon in the top-right corner of the dashboard.

### Monday.com API Token

Required for: Roundtable Status tab, Client Activity tab, Mentions, and posting notes to Monday boards.

1. In Monday.com, go to your **Profile → Admin → API**
2. Copy your Personal API Token
3. In the QCL Settings modal, paste it into **Monday.com → API Token** and click **Save Token**

If you haven't added a token, Monday features will show a "Monday not configured" message instead of data.

### Google Account

Required for: Calendar panel and Gmail inbox on the Overview tab.

1. In Settings, scroll to **Google Account**
2. Click **Connect Google** — you'll be taken to Google's sign-in page
3. Approve access and you'll be redirected back to the app
4. The section will now show **✓ Connected**

To disconnect, click **Disconnect** in the same section.

> **Note:** The Connect Google button only appears if the server has Google OAuth credentials configured. If you don't see it, ask your admin to add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` to the `.env.local` file.

---

## Admin Panel

The admin panel is a separate interface for managing team member accounts. It is only accessible to the **admin account** (admin@qcl.com).

**URL:** http://localhost:3000/admin

When you log in as admin, you are taken directly to this panel. Regular team members cannot access it.

### What you can do in the Admin Panel

- **View all accounts** — see every team member's name, email, role, whether their Monday API token is configured, and whether their Google account is connected
- **Add a new team member** — click **+ Add Member**, fill in their name, email, and a temporary password. They can change their password later.
- **Set Monday API token** — click **Set Token** next to any user to paste their Monday API token directly into their account
- **Reset a password** — click **Reset PW** to set a new password for any user (useful if they forget theirs)
- **Delete an account** — click **Delete** to remove a team member. The owner account cannot be deleted.

### Admin account credentials

- Email: `admin@qcl.com`
- Password: `12345678`

---

## Mobile View

The app has a mobile-optimized view you can use on your phone — no separate app needed.

**To open it:** On the dashboard header, tap the **📱** button. Or go directly to `/mobile` on the hosted URL.

### What the mobile view includes

All 7 sections accessible from a bottom navigation bar:

| Tab | What it shows |
|---|---|
| **Home** | Stats summary, upcoming ERTs (next 30 days), quick task list |
| **Clients** | Searchable client list with status filter, tap any client to add notes |
| **Tasks** | Full task list — add, complete, view done tasks |
| **Meeting** | Meeting draft — pick a client, write notes, add action items, push to tasks |
| **ERT** | Roundtable data from Monday (same as desktop Roundtable tab) |
| **VAs** | VA attendance stats by month, log new attendance entries |
| **Activity** | VA activity log (connection requests, InMails, event invites) |

The mobile view supports iOS safe areas (notch + home indicator) and has large touch targets throughout. Use the **Desktop** link in the top header to switch back to the full desktop view.

---

## The Five Tabs

### Overview
Your main dashboard. Contains four panels:

- **Upcoming ERTs** (left) — all events in the next 30 days, with days remaining and confirmed attendees
- **My Tasks** (left, below ERTs) — personal task list with priorities and due dates
- **Google Calendar** (right) — your upcoming calendar events
- **Gmail Inbox** (right) — your recent emails
- **Meeting Draft** (right, below inbox) — scratchpad for meeting notes and action items

### All Clients
Full list of every client. You can:
- Search by name or email
- Filter by VA or status
- Click any row to view full client details
- Click the status pill to change it inline
- Sort by name, ERT date, attendees, or days to ERT
- The **Attendees** column is pulled live from your Monday roundtable board

### Roundtable Status
Live data from your Monday.com roundtable board — shows all ERTs per client with attendees, registered count, and calendar confirmation status. Has a Refresh button (data is cached so switching tabs doesn't re-fetch).

### VA Tracker
Attendance tracking for your five VAs: **Claire**, **Rosalie**, **Aliah**, **Arvi**, **Peevee**. Tracks lates, absences, and out-of-zoom per month. Strike system:
- 3 lates = 1 strike
- 2 absences = 1 strike
- Background turns red at 3+ strikes

### Client Activity
Daily VA outreach numbers — submitted each day by VAs via the VA Report form at `/va-report`. Shows per-client totals for connection requests, InMails, and LinkedIn event invites. Filter by VA or date range. Also shows a recent submissions log at the bottom.

---

## VA Daily Report

VAs submit their daily outreach numbers at **http://localhost:3000/va-report** (or the hosted URL when live).

On the form they fill in:
- Their name (VA dropdown)
- Which client they worked on
- PM name
- Date (auto-filled to today)
- Number of connection requests sent
- Number of InMails sent
- Number of LinkedIn event invites sent

The system blocks duplicate submissions — a VA can only submit once per client per day. If they try again, they'll see an error message.

All submissions appear immediately in the **Client Activity** tab on the dashboard.

---

## My Tasks Panel

The task panel lives on the Overview tab below the Upcoming ERTs table.

- **Add a task**: type in the input box and press Enter (or click Add)
- **Complete a task**: tick the checkbox — it moves to the Done filter
- **Set priority**: click the ☆/★/!! button to cycle between Normal → Important → Urgent
- **Delete a task**: click the × button
- Filter between **Active** and **Done** using the buttons in the panel header
- The AI assistant can also add tasks for you — just ask it

---

## Meeting Draft Panel

The meeting draft panel is on the Overview tab, directly below the Gmail inbox.

Use it to take notes during a client call and capture action items:

1. **Select the client** from the dropdown in the panel header
2. **Write your notes** in the top section — anything discussed in the meeting
3. **Add action items** using the input below — things you agreed to do
4. After the meeting, use the footer buttons:
   - **Save as note** — saves the full draft (notes + action items) as a note on the client's record
   - **Push to tasks** — sends all unchecked action items to your task list, prefixed with the client name (e.g. "Mike Brown - call him tomorrow")
   - **Clear** — wipes the draft after confirmation

The draft **auto-saves** as you type — it will still be there if you refresh the page.

---

## Posting Notes to Monday.com

Every note on a client's record has two small Monday buttons:
- **Board** — posts the note to that client's own Monday board
- **MCL** — posts the note to the Master Client List board

The AI automatically figures out which bubble to post in (Scheduling, Messaging, Targeting, etc.) based on the note content.

---

## Adding a New Client

1. Click **+ Add client** (top right of the header)
2. Fill in the form — only **Client Name** is required
3. Click **Save**

---

## Editing a Client

1. Find the client in the **All Clients** tab
2. Click the **Edit** (✏) button on their row, or open the client and click Edit inside
3. Make your changes and click **Save**

---

## Adding a Note to a Client

1. Click any client row to open their detail view
2. Type your note at the bottom and click **Add** (or press Enter)

Notes are permanent and timestamped.

---

## Logging VA Attendance

1. Go to the **VA Tracker** tab
2. Click **Log Attendance**
3. Select the VA, the date, and mark late / absent / out of Zoom
4. Add any notes and click **Save**

---

## Using the AI Assistant

Click the 🤖 button in the bottom-right corner to open the AI assistant. You can type in plain English.

**Examples:**

| What you type | What it does |
|---|---|
| `Mike Brown 18 attendees` | Updates attendee count |
| `Mark Greg Barker as At Risk` | Changes client status |
| `Deron's ERT is June 20` | Sets the ERT date |
| `Flag Carol — not responding` | Sets a flag on the client |
| `Add note to Jon Kidwell: left voicemail` | Logs a note |
| `Add a task: follow up with Rosalie by Friday` | Adds to your task list |
| `Draft an email to Brian Keltner about his ERT` | Composes an email |
| `Schedule a call with Aliah tomorrow at 3pm` | Creates a calendar event |
| `Post to Monday for Don Durand: ERT confirmed for June 25` | Posts to his Monday board |
| `Show roundtable status` | Navigates to that tab |
| `Remember: my Zoom link is zoom.us/j/123456` | Saves to AI memory |

The AI remembers facts you tell it (Zoom links, preferences, timezones) across conversations via its memory system. You can also add custom rules and SOPs in the **KB** (knowledge base) button inside the assistant panel.

---

## Client Status Options

| Status | Meaning |
|---|---|
| New Client | Just onboarded, campaign starting |
| Performing | Generating well |
| Slow Generating | Below expectations |
| At Risk | Needs immediate attention |
| Stopped | Campaign paused or ended |

---

## Your Team

| VA | Type | Color |
|---|---|---|
| Claire | Full Time | Red |
| Rosalie | Full Time | Purple |
| Aliah | Full Time | Amber |
| Arvi | Full Time | Blue |
| Peevee | Part Time | Green |

---

## The Database (Where Your Data Lives)

All your data is stored in a single file:
```
~/Downloads/qcl-app/data/qcl.db
```

To back it up, copy that file somewhere safe (iCloud, external drive). To restore, copy it back and restart the app.

---

## If Something Breaks

1. Check the Terminal is still running
2. Try refreshing the browser (Cmd + R)
3. If that doesn't help, stop the app (Ctrl + C) and start it again (`npm run dev`)
4. For data issues, inspect directly:
   ```
   sqlite3 -column -header ~/Downloads/qcl-app/data/qcl.db "SELECT name, va, status FROM clients WHERE status != 'Stopped';"
   ```

---

## Backup Your Data

Your data is only on your machine — there is no automatic backup.

1. Copy `~/Downloads/qcl-app/data/qcl.db` to iCloud or an external drive
2. Do this regularly
3. To restore: copy the `.db` file back to the same location and restart the app
