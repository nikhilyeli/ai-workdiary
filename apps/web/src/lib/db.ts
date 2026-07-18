import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "workdiary.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
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
      version        INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_versions (
      id             TEXT PRIMARY KEY,
      activity_id    TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      version        INTEGER NOT NULL,
      action         TEXT NOT NULL CHECK(action IN ('created','updated','deleted')),
      snapshot       TEXT NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
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

    CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
    CREATE INDEX IF NOT EXISTS idx_activities_time ON activities(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_activity_versions_activity ON activity_versions(activity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_worklog_user    ON worklog_drafts(user_id);
  `);

  const hasVersionColumn = db
    .prepare("PRAGMA table_info(activities)")
    .all()
    .some((col) => (col as { name: string }).name === "version");

  if (!hasVersionColumn) {
    db.exec("ALTER TABLE activities ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
  }
}
