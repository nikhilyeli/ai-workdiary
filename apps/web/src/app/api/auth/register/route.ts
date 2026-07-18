import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { apiError } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 10;
const MAX_DEVICE_LABEL_LENGTH = 80;

function normalizeDeviceLabel(raw: string | null): string {
  const cleaned = (raw ?? "")
    .replace(/[^\w .\-()]/g, "")
    .trim()
    .slice(0, MAX_DEVICE_LABEL_LENGTH);
  return cleaned || "Unknown Device";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimited = enforceRateLimit(req, "auth:register", 5, 15 * 60 * 1000);
  if (rateLimited) return rateLimited;

  let body: { email?: string; name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const { email, name, password } = body;

  if (!email || !EMAIL_RE.test(email)) {
    return apiError("Valid email is required");
  }
  if (!name || name.trim().length < 2) {
    return apiError("Name must be at least 2 characters");
  }
  if (!password || password.length < MIN_PASSWORD_LEN) {
    return apiError(
      `Password must be at least ${MIN_PASSWORD_LEN} characters`
    );
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email.toLowerCase());
  if (existing) {
    return apiError("Email already registered", 409);
  }

  const userId = uuidv4();
  const passwordHash = await hashPassword(password);
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)"
  ).run(userId, email.toLowerCase(), name.trim(), passwordHash);

  const deviceLabel = normalizeDeviceLabel(req.headers.get("x-device-label"));
  const { session, tokens } = await createSession(userId, deviceLabel);

  return NextResponse.json({ tokens, session_id: session.id }, { status: 201 });
}
