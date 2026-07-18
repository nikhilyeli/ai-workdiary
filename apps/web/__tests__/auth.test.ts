import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

// We test the auth logic directly against an in-memory SQLite database
// to avoid file-system side effects during testing.

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
    CREATE TABLE IF NOT EXISTS sessions (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_label      TEXT NOT NULL DEFAULT 'Unknown Device',
      refresh_token_hash TEXT NOT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at      TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at        TEXT NOT NULL
    );
  `);
  return db;
}

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await bcrypt.hash("mysecurepass", 10);
    expect(hash).not.toBe("mysecurepass");
    await expect(bcrypt.compare("mysecurepass", hash)).resolves.toBe(true);
    await expect(bcrypt.compare("wrongpass", hash)).resolves.toBe(false);
  });

  it("different hashes for the same password (salting)", async () => {
    const h1 = await bcrypt.hash("samepassword", 10);
    const h2 = await bcrypt.hash("samepassword", 10);
    expect(h1).not.toBe(h2);
  });
});

describe("session management", () => {
  let db: Database.Database;
  let userId: string;

  beforeEach(async () => {
    db = initTestDb();
    userId = uuidv4();
    const hash = await bcrypt.hash("testpassword", 10);
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)"
    ).run(userId, "user@test.com", "Test User", hash);
  });

  afterEach(() => {
    db.close();
  });

  it("creates a session and retrieves it", () => {
    const sessionId = uuidv4();
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    db.prepare(
      `INSERT INTO sessions (id, user_id, device_label, refresh_token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, userId, "Test Device", "fakehash", expiresAt);

    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(sessionId) as { id: string; user_id: string };

    expect(session.id).toBe(sessionId);
    expect(session.user_id).toBe(userId);
  });

  it("deletes session on cascade when user is deleted", () => {
    const sessionId = uuidv4();
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    db.prepare(
      `INSERT INTO sessions (id, user_id, device_label, refresh_token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, userId, "Test Device", "fakehash", expiresAt);

    db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    const session = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(sessionId);
    expect(session).toBeUndefined();
  });

  it("returns only non-expired sessions", () => {
    const expiredId = uuidv4();
    const activeId = uuidv4();

    // Use SQLite-compatible datetime strings (space separator, no trailing Z/ms)
    // so string comparison with datetime('now') works correctly.
    const sqliteNow = (offsetMs: number) =>
      new Date(Date.now() + offsetMs)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);

    const past = sqliteNow(-60_000); // 1 minute ago
    const future = sqliteNow(30 * 24 * 60 * 60 * 1000);

    db.prepare(
      `INSERT INTO sessions (id, user_id, device_label, refresh_token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(expiredId, userId, "Old Device", "hash1", past);

    db.prepare(
      `INSERT INTO sessions (id, user_id, device_label, refresh_token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(activeId, userId, "New Device", "hash2", future);

    const activeSessions = db
      .prepare(
        `SELECT * FROM sessions WHERE user_id = ? AND expires_at > datetime('now')`
      )
      .all(userId) as { id: string }[];

    expect(activeSessions.length).toBe(1);
    expect(activeSessions[0].id).toBe(activeId);
  });
});

describe("user uniqueness", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("rejects duplicate email registration", async () => {
    const hash = await bcrypt.hash("pass1234567", 10);
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)"
    ).run(uuidv4(), "dup@test.com", "User One", hash);

    expect(() => {
      db.prepare(
        "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)"
      ).run(uuidv4(), "dup@test.com", "User Two", hash);
    }).toThrow();
  });
});
