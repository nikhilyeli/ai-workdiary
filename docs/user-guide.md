# User Guide

## Getting Started

### 1. Register an Account

Open the app and click **Create one** on the login page, or navigate to `/register`.

- Enter your name, email address, and a password (minimum 10 characters).
- Your account is created and you are automatically signed in.

### 2. Onboarding Tour

On your first login, an **interactive guided tour** walks you through all dashboard sections. You can replay it any time by clicking the **?** button in the header.

---

## Dashboard Overview

The dashboard has three tabs:

| Tab | Purpose |
|---|---|
| 📋 **Activities** | Review, edit, and approve work entries |
| 📝 **Worklogs** | View and confirm worklog drafts |
| 🖥 **Sessions** | Manage your active device sessions |

---

## Activities Tab

### Reviewing an Activity

Each activity card shows:
- Source icon (Jira 🎯, Bitbucket 🔀, Browser 🌐, System 💻, Manual ✍️)
- Title and status badge
- Ticket number (if set)
- Timestamp

**Status flow:**
```
pending → reviewed → approved
               └──→ skipped
```

### Editing an Activity

Click **Edit** on any card to:
- Update the title or description
- Add or change the ticket number (e.g. `PROJ-123`)
- Write a worklog note that will be used in the draft
- Change the status

Click **Save** to apply changes or **Cancel** to discard.

### Version History and Concurrent Editing

- Click **History** on an activity card to view its saved state history.
- Edits use optimistic concurrency (`expected_version`) to prevent silent overwrite when two sessions edit the same record.
- If a conflict is detected, the app asks you to reload the latest data.

### Approving an Activity

Click **Approve** to mark an activity as ready for worklog draft generation.

> Approved activities cannot be deleted, only moved back to "reviewed".

### Creating a Worklog Draft

Once an activity is **Approved** and has a ticket number:

1. Click **→ Worklog** on the activity card.
2. A worklog draft is generated using the ticket number and worklog note.
3. Switch to the **Worklogs** tab to review it.

### Adding a Manual Entry

Click **+ Add manual entry** to create an activity for anything not automatically collected:

- Meetings, calls, design sessions, code reviews
- Activities from tools not yet connected

### Exporting Activities

Use **Export JSON** or **Export CSV** in the Activities toolbar.

---

## Worklogs Tab

This tab shows all generated worklog drafts.

Filter by **Pending** (not yet logged), **Logged** (confirmed), or **All**.

Use **Export JSON** or **Export CSV** to download worklog drafts.

### Submitting a Worklog

1. Open **Atlassian Worklog Pro** in your browser.
2. Find the Jira ticket.
3. Manually enter the worklog using the ticket number, description, and time spent shown in the draft.
4. Return to AI Work Diary and click **Mark logged** on the draft.

> **AI Work Diary is an orchestrator, not an auto-synchronizer.** It never submits worklogs on your behalf. You confirm every action.

---

## Sessions Tab

You can sign in from multiple devices (laptop, desktop, phone) using the same account.

### Managing Sessions

- Each device appears as a session with its label, creation date, and last-used date.
- The current device is highlighted with **"This device"**.
- Click **Revoke** to sign out a specific device remotely.
- Click **Sign out all devices** to immediately revoke every session.

Sessions expire automatically after **30 days of inactivity**.

---

## Signing Out

Click **Sign out** in the top-right corner of the header. This signs out your current device only.

To sign out all devices, use the **Sessions** tab → **Sign out all devices**.
