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

Leave the Terminal window open while you use the app — closing it will stop the app.

---

## How to Stop the App

Go back to the Terminal window and press **Ctrl + C**.

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

### Activity
Live activity metrics from your Monday.com tracking board — connection requests, LI invites, inmails, and connections made per client. Click any client row to expand and see the daily breakdown.

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
