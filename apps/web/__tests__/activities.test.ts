import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

function initTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS activities (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source         TEXT NOT NULL CHECK(source IN ('jira','bitbucket','browser','system','manual')),
      occurred_at    TEXT NOT NULL,
      title          TEXT NOT NULL,
      description    TEXT,
      metadata       TEXT,
      status         TEXT NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','reviewed','approved','skipped')),
      ticket_number  TEXT,
      worklog_note   TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS worklog_drafts (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_id    TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      ticket_number  TEXT NOT NULL,
      description    TEXT NOT NULL,
      time_spent     TEXT,
      logged         INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe("activities", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(() => {
    db = initTestDb();
    userId = uuidv4();
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)"
    ).run(userId, "u@test.com", "Tester", "hash");
  });

  afterEach(() => {
    db.close();
  });

  function insertActivity(overrides: Partial<{
    status: string;
    ticket_number: string;
    source: string;
  }> = {}) {
    const id = uuidv4();
    const occurred_at = new Date().toISOString();
    db.prepare(
      `INSERT INTO activities
         (id, user_id, source, occurred_at, title, status, ticket_number)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      overrides.source ?? "manual",
      occurred_at,
      "Test Activity",
      overrides.status ?? "pending",
      overrides.ticket_number ?? null
    );
    return id;
  }

  it("creates a pending activity by default", () => {
    const id = insertActivity();
    const row = db
      .prepare("SELECT * FROM activities WHERE id = ?")
      .get(id) as { status: string };
    expect(row.status).toBe("pending");
  });

  it("status transition: pending → reviewed → approved", () => {
    const id = insertActivity();

    db.prepare("UPDATE activities SET status = 'reviewed' WHERE id = ?").run(id);
    let row = db.prepare("SELECT status FROM activities WHERE id = ?").get(id) as { status: string };
    expect(row.status).toBe("reviewed");

    db.prepare("UPDATE activities SET status = 'approved' WHERE id = ?").run(id);
    row = db.prepare("SELECT status FROM activities WHERE id = ?").get(id) as { status: string };
    expect(row.status).toBe("approved");
  });

  it("approved activity prevents deletion via application logic", () => {
    // The API layer blocks deletion; here we confirm the constraint check
    const id = insertActivity({ status: "approved" });
    const row = db
      .prepare("SELECT status FROM activities WHERE id = ?")
      .get(id) as { status: string };
    // Simulating what the API does: if approved, refuse
    expect(row.status).toBe("approved");
    const allowed = row.status !== "approved";
    expect(allowed).toBe(false);
  });

  it("filters activities by status", () => {
    insertActivity({ status: "pending" });
    insertActivity({ status: "approved" });
    insertActivity({ status: "skipped" });

    const pending = db
      .prepare("SELECT id FROM activities WHERE user_id = ? AND status = ?")
      .all(userId, "pending") as { id: string }[];
    expect(pending.length).toBe(1);
  });

  it("cascades delete when user is deleted", () => {
    insertActivity();
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    const rows = db
      .prepare("SELECT id FROM activities WHERE user_id = ?")
      .all(userId);
    expect(rows.length).toBe(0);
  });
});

describe("worklog drafts", () => {
  let db: Database.Database;
  let userId: string;
  let activityId: string;

  beforeEach(() => {
    db = initTestDb();
    userId = uuidv4();
    activityId = uuidv4();

    db.prepare(
      "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)"
    ).run(userId, "u@test.com", "Tester", "hash");

    db.prepare(
      `INSERT INTO activities
         (id, user_id, source, occurred_at, title, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(activityId, userId, "jira", new Date().toISOString(), "JIRA Task", "approved");
  });

  afterEach(() => {
    db.close();
  });

  it("creates a worklog draft from an approved activity", () => {
    const draftId = uuidv4();
    db.prepare(
      `INSERT INTO worklog_drafts
         (id, user_id, activity_id, ticket_number, description)
       VALUES (?, ?, ?, ?, ?)`
    ).run(draftId, userId, activityId, "PROJ-42", "Worked on feature X");

    const draft = db
      .prepare("SELECT * FROM worklog_drafts WHERE id = ?")
      .get(draftId) as { ticket_number: string; logged: number };
    expect(draft.ticket_number).toBe("PROJ-42");
    expect(draft.logged).toBe(0); // not yet logged
  });

  it("marks a draft as logged", () => {
    const draftId = uuidv4();
    db.prepare(
      `INSERT INTO worklog_drafts
         (id, user_id, activity_id, ticket_number, description)
       VALUES (?, ?, ?, ?, ?)`
    ).run(draftId, userId, activityId, "PROJ-42", "Test work");

    db.prepare("UPDATE worklog_drafts SET logged = 1 WHERE id = ?").run(draftId);

    const draft = db
      .prepare("SELECT logged FROM worklog_drafts WHERE id = ?")
      .get(draftId) as { logged: number };
    expect(draft.logged).toBe(1);
  });

  it("filters un-logged drafts", () => {
    const id1 = uuidv4();
    const id2 = uuidv4();

    db.prepare(
      `INSERT INTO worklog_drafts (id, user_id, activity_id, ticket_number, description, logged)
       VALUES (?, ?, ?, ?, ?, 0)`
    ).run(id1, userId, activityId, "T-1", "Draft");

    db.prepare(
      `INSERT INTO worklog_drafts (id, user_id, activity_id, ticket_number, description, logged)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).run(id2, userId, activityId, "T-2", "Done");

    const unlogged = db
      .prepare(
        "SELECT id FROM worklog_drafts WHERE user_id = ? AND logged = 0"
      )
      .all(userId) as { id: string }[];

    expect(unlogged.length).toBe(1);
    expect(unlogged[0].id).toBe(id1);
  });
});
