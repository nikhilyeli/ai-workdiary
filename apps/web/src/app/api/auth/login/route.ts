import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { apiError } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";

const GENERIC_AUTH_ERROR = "Invalid email or password";
const MAX_DEVICE_LABEL_LENGTH = 80;

function normalizeDeviceLabel(raw: string | null): string {
  const cleaned = (raw ?? "")
    .replace(/[^\w .\-()]/g, "")
    .trim()
    .slice(0, MAX_DEVICE_LABEL_LENGTH);
  return cleaned || "Unknown Device";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimited = enforceRateLimit(req, "auth:login", 10, 15 * 60 * 1000);
  if (rateLimited) return rateLimited;

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const { email, password } = body;

  if (!email || !password) {
    return apiError(GENERIC_AUTH_ERROR, 401);
  }

  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase()) as
    | { id: string; email: string; password_hash: string }
    | undefined;

  // Always run bcrypt to prevent timing-based user enumeration
  const passwordOk = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, "$2b$12$invalidhashpadding00000000000000000000000000000000000000");

  if (!user || !passwordOk) {
    return apiError(GENERIC_AUTH_ERROR, 401);
  }

  const deviceLabel = normalizeDeviceLabel(req.headers.get("x-device-label"));
  const { session, tokens } = await createSession(user.id, deviceLabel);

  return NextResponse.json({ tokens, session_id: session.id });
}
