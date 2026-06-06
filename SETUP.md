# QCL App — Setup Guide

This guide has two parts:
- **Part 1** — Steps for Marwan to upload the project to GitHub
- **Part 2** — Steps for a teammate to install and run the app on a brand-new Mac

---

## Before you start — share your API keys safely

The `.env.local` file contains secret API keys and is **never uploaded to GitHub**. You must send it to your teammate separately — via WhatsApp, email, or any private message. They will need it in Part 2.

The file is at: `~/Downloads/qcl-app/.env.local`

Open it in any text editor, copy the entire contents, and send it privately.

---

---

# PART 1 — Upload to GitHub (Marwan's steps)

Do this once from your own Mac.

---

### Step 1 — Create a GitHub account

Go to **https://github.com** and create a free account if you don't already have one.

---

### Step 2 — Create a new private repository

1. Click the **+** icon in the top-right corner → **New repository**
2. Fill in:
   - **Repository name:** `qcl-app`
   - **Visibility:** select **Private** (important — keeps your client data private)
   - Leave everything else unchecked
3. Click **Create repository**
4. On the next page, copy the URL shown — it will look like:
   ```
   https://github.com/YOUR-USERNAME/qcl-app.git
   ```
   You'll need this in Step 5.

---

### Step 3 — Open Terminal

Press `Cmd + Space`, type **Terminal**, press Enter.

---

### Step 4 — Navigate to the project

Type this and press Enter:

```bash
cd ~/Downloads/qcl-app
```

---

### Step 5 — Connect your project to GitHub

Run these commands **one at a time**, pressing Enter after each:

```bash
git add .
```

```bash
git commit -m "Full QCL app"
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/qcl-app.git
```

> ⚠️ Replace `YOUR-USERNAME` with your actual GitHub username and `qcl-app` with the exact repo name you chose.

```bash
git push -u origin main
```

When it asks for your **username and password**, enter your GitHub username and a **Personal Access Token** (not your GitHub password). To create one:
1. GitHub → your profile photo → **Settings**
2. Scroll down → **Developer settings** (bottom of left sidebar)
3. **Personal access tokens → Tokens (classic) → Generate new token (classic)**
4. Give it a name, tick **repo**, scroll down, click **Generate token**
5. Copy the token — use it as the password when prompted

---

### Step 6 — Verify

Go to `https://github.com/YOUR-USERNAME/qcl-app` in your browser. You should see all your files there. The `.env.local` file and `data/` folder will **not** appear — this is correct, they are protected.

---

---

# PART 2 — Run the app on a new Mac (teammate's steps)

Do this on the new laptop. It starts from zero — nothing needs to be installed beforehand.

---

### Step 1 — Install Xcode Command Line Tools

This is required for the database to work. Open **Terminal** (press `Cmd + Space`, type Terminal, Enter) and run:

```bash
xcode-select --install
```

A popup will appear — click **Install** and wait for it to finish (about 5 minutes).

---

### Step 2 — Install Node.js

1. Go to **https://nodejs.org**
2. Click the big **LTS** download button (the one labeled "Recommended for most users")
3. Open the downloaded `.pkg` file and follow the installer
4. When done, verify it worked by running in Terminal:

```bash
node --version
```

You should see a version number like `v22.x.x`. If you do, Node.js is installed correctly.

---

### Step 3 — Install Git

Git is usually installed automatically with the Xcode tools from Step 1. Check by running:

```bash
git --version
```

If you see a version number, you're good. If not, download Git from **https://git-scm.com/download/mac** and install it.

---

### Step 4 — Get access to the repository

Ask Marwan to add you as a collaborator:
1. Marwan goes to the GitHub repo → **Settings → Collaborators → Add people**
2. Enter your GitHub username or email
3. You'll receive an email invitation — accept it

If you don't have a GitHub account, create one at **https://github.com** first.

---

### Step 5 — Clone the project

In Terminal, run:

```bash
cd ~/Downloads
```

```bash
git clone https://github.com/MARWANS-USERNAME/qcl-app.git
```

> Replace `MARWANS-USERNAME` with Marwan's actual GitHub username.

This will create a `qcl-app` folder inside your Downloads.

---

### Step 6 — Add the API keys file

The project needs a file called `.env.local` that Marwan sent you privately. Create it now:

1. In Terminal, run:

```bash
cd ~/Downloads/qcl-app
```

```bash
open .
```

This opens the `qcl-app` folder in Finder.

2. Press `Cmd + Shift + .` to show hidden files
3. Create a new file called `.env.local` in that folder:
   - Open **TextEdit** (press Cmd+Space, type TextEdit, Enter)
   - Go to **Format → Make Plain Text**
   - Paste the contents Marwan sent you
   - Save the file as `.env.local` inside the `qcl-app` folder
   - When asked about the extension, click **Use .env.local**

> ⚠️ The filename must be exactly `.env.local` — it starts with a dot.

---

### Step 7 — Install dependencies

Back in Terminal (make sure you're inside the qcl-app folder — run `cd ~/Downloads/qcl-app` if unsure):

```bash
npm install
```

This will take 1–3 minutes. You'll see a lot of text scrolling — that's normal.

---

### Step 8 — Start the app

```bash
npm run dev
```

Wait a few seconds until you see a message that includes `localhost:3000`.

---

### Step 9 — Open in browser

Open any browser (Safari, Chrome, etc.) and go to:

```
http://localhost:3000
```

The app should be running. 🎉

---

### To stop the app

Go back to the Terminal window and press **Ctrl + C**.

### To start it again next time

Open Terminal and run:

```bash
cd ~/Downloads/qcl-app
npm run dev
```

Then go to `http://localhost:3000`.

---

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails with errors about "build tools" | Re-run Step 1 (Xcode tools) — make sure it completed fully |
| App shows a blank page or error | Check the Terminal window for red error messages |
| Calendar / Gmail not working | The Google OAuth was set up for Marwan's account — you'll need to go through the Connect Google button in the app and use your own Google account |
| Port already in use | Another app is using port 3000 — restart your Mac and try again |
| Can't find the `.env.local` file in Finder | Press `Cmd + Shift + .` to toggle hidden files |
