import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db";
import type { JWTPayload, AuthTokens, Session } from "@/types";

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_DAYS = 30;
const MAX_SESSIONS_PER_USER = 10;
const REFRESH_RACE_GRACE_MS = 5000;

function toSqliteDateTime(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function parseSqliteDateTime(value: string): number {
  return Date.parse(`${value.replace(" ", "T")}Z`);
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET env var must be set and at least 32 characters long"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  // 48 random bytes → 96 hex chars
  const buf = new Uint8Array(48);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashRefreshToken(token: string): Promise<string> {
  // SHA-256 via Web Crypto – no need to store full bcrypt cost for a
  // random token; we just need tamper-evidence.
  const data = new TextEncoder().encode(token);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(
  userId: string,
  deviceLabel: string
): Promise<{ session: Session; tokens: AuthTokens }> {
  const db = getDb();

  // Enforce per-user session cap – evict the oldest if at cap
  const count = (
    db
      .prepare("SELECT COUNT(*) as c FROM sessions WHERE user_id = ?")
      .get(userId) as { c: number }
  ).c;
  if (count >= MAX_SESSIONS_PER_USER) {
    db.prepare(
      `DELETE FROM sessions WHERE id = (
         SELECT id FROM sessions WHERE user_id = ?
         ORDER BY last_used_at ASC LIMIT 1
       )`
    ).run(userId);
  }

  const sessionId = uuidv4();
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  db.prepare(
    `INSERT INTO sessions (id, user_id, device_label, refresh_token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, userId, deviceLabel, refreshTokenHash, toSqliteDateTime(expiresAt));

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as {
    id: string;
    email: string;
  };

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    session_id: sessionId,
  });

  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as Session;

  return {
    session,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
  };
}

export async function rotateRefreshToken(
  sessionId: string,
  oldRefreshToken: string
): Promise<AuthTokens | null> {
  const db = getDb();
  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as Session | undefined;

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  const expectedHash = await hashRefreshToken(oldRefreshToken);
  if (expectedHash !== session.refresh_token_hash) {
    const lastUsedTs = parseSqliteDateTime(session.last_used_at);
    if (
      Number.isFinite(lastUsedTs) &&
      Date.now() - lastUsedTs <= REFRESH_RACE_GRACE_MS
    ) {
      return null;
    }
    // Possible token reuse – invalidate the session immediately
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);
  const newExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  db.prepare(
    `UPDATE sessions
     SET refresh_token_hash = ?, expires_at = ?, last_used_at = datetime('now')
     WHERE id = ?`
  ).run(newRefreshTokenHash, toSqliteDateTime(newExpiresAt), sessionId);

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(session.user_id) as { id: string; email: string };

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    session_id: sessionId,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export function revokeSession(sessionId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function revokeSessionForUser(sessionId: string, userId: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?")
    .run(sessionId, userId);
  return result.changes > 0;
}

export function revokeAllUserSessions(userId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function isSessionActive(sessionId: string, userId: string): boolean {
  const session = getDb()
    .prepare(
      `SELECT id FROM sessions
       WHERE id = ? AND user_id = ? AND expires_at > datetime('now')`
    )
    .get(sessionId, userId) as { id: string } | undefined;
  return Boolean(session);
}

export function getActiveSessions(userId: string): Session[] {
  return getDb()
    .prepare(
      `SELECT * FROM sessions
       WHERE user_id = ? AND expires_at > datetime('now')
       ORDER BY last_used_at DESC`
    )
    .all(userId) as Session[];
}
