# Complete Usage Guide

How to use every feature of AI Work Diary.

---

## Dashboard overview

After signing in you land on the **Dashboard** with three tabs:

| Tab | Icon | Purpose |
|---|---|---|
| Activities | 📋 | Review, edit, approve, import, and export work entries |
| Worklogs | 📝 | View worklog drafts and mark them submitted |
| Sessions | 🖥 | Manage active login sessions across devices |

---

## Activities tab

### Activity cards

Each card shows:
- **Source icon** — Jira 🎯 / Bitbucket 🔀 / Browser 🌐 / System 💻 / Manual ✍️
- **Title** and **status badge** (pending / reviewed / approved / skipped)
- **Ticket number** (if set)
- **Timestamp**

### Status flow

```
pending → reviewed → approved → (create worklog draft)
                └──→ skipped
approved → reviewed  (un-approve)
```

### Approving an activity

Click **Approve** on any non-skipped card. Approved activities cannot be deleted.

### Editing an activity

1. Click **Edit** on a card.
2. Change title, ticket number, worklog note, or status.
3. Click **Save**.

> Concurrent-edit protection: if another session edited the same activity while you were editing, you will see a conflict alert and the latest data will be reloaded.

### Viewing version history

Click **History** on any card to see a timeline of every change:
- Version number
- Action (created / updated / deleted)
- Timestamp

### Adding a manual entry

1. Click **+ Add manual entry**.
2. Fill in title (required), ticket number, description, and date/time.
3. Click **Save**.

### Exporting activities

Click one of the export buttons in the toolbar:

| Button | Format | Opens in |
|---|---|---|
| **JSON** | JSON file | Any text editor or code tool |
| **CSV** | Comma-separated values | Excel, Sheets, Numbers |
| **XLSX** | Excel workbook | Microsoft Excel, LibreOffice Calc |
| **DOCX** | Word document | Microsoft Word, LibreOffice Writer |

Export respects any active filters (date range, status, source).

### Importing activities

1. Click **📂 Import** in the toolbar.
2. Optionally download a **CSV Template** or **Excel Template** to see the required column format.
3. Fill in your data using any spreadsheet or text editor.
4. Click **Choose file to import** and select your `.csv`, `.json`, or `.xlsx` file.
5. A summary shows how many rows were imported and any skipped rows with reasons.

#### Import column reference

| Column | Required | Values |
|---|---|---|
| `source` | No (default: `manual`) | `jira`, `bitbucket`, `browser`, `system`, `manual` |
| `occurred_at` | ✅ Yes | Any valid date/time (ISO 8601, `YYYY-MM-DD`, etc.) |
| `title` | ✅ Yes | Free text |
| `description` | No | Free text |
| `ticket_number` | No | e.g. `PROJ-123` |
| `worklog_note` | No | Free text |

---

## Worklogs tab

### Creating a worklog draft

From the Activities tab:
1. Make sure the activity has a **ticket number**.
2. Click **Approve** on the activity.
3. Click **→ Worklog** (appears only on approved activities).
4. Switch to the **Worklogs** tab to see the draft.

### Filters

| Filter | Shows |
|---|---|
| Pending | Drafts not yet submitted |
| Logged | Drafts marked as submitted |
| All | Everything |

### Marking a draft as logged

1. Open **Atlassian Worklog Pro** (or your Jira instance).
2. Find the ticket and manually enter the worklog using the details shown in the draft.
3. Return to AI Work Diary.
4. Click **Mark logged** on the draft and confirm.

> **AI Work Diary never auto-submits.** You confirm every action.

### Exporting worklogs

Use the export buttons (JSON / CSV / Excel / Word) in the Worklogs toolbar. The export respects the current Pending/Logged/All filter.

---

## Sessions tab

### What is a session?

Each time you sign in on a device, a session is created and stored in the database. Up to **10 concurrent sessions** are allowed per account.

### Revoking a session

Click **Revoke** next to any session to immediately sign out that device.

### Sign out all devices

Click **Sign out all devices** to revoke every session at once. Useful if you suspect account compromise.

### The current device

Your current session is labelled **"This device"** and includes your detected browser and platform (e.g. "Chrome on Windows").

---

## Authentication

### Login

- URL: `/login`
- Up to **10 login attempts per IP per 15 minutes**.
- JWT access tokens expire in **15 minutes** and auto-refresh in the background.

### Register

- URL: `/register`
- Up to **5 registration attempts per IP per 15 minutes**.
- Password must be ≥ 10 characters.

### Sign out

Click **Sign out** in the top-right header. This only signs out the current device.

---

## Keyboard shortcuts (planned — not yet implemented)

| Action | Shortcut |
|---|---|
| Approve activity | `A` (when card is focused) |
| Edit activity | `E` |
| Skip activity | `S` |

---

## Multi-device usage

Sign in from any browser or device using the same email and password. Each device gets its own session. All data is shared from the same SQLite database on the server.

For mobile use, see the [PWA Install Guide](./pwa-install.md).

---

## Tips

- Use the **ticket number** field consistently — it links activities to worklog drafts.
- The **worklog note** field overrides the description when generating the draft. Use it for your formatted worklog text.
- Export to **Excel** before a long review session as a backup.
- Use **Import** to bulk-add activities from spreadsheets or other tools.
