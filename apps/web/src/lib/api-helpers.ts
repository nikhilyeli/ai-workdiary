import { NextRequest, NextResponse } from "next/server";
import { isSessionActive, verifyAccessToken } from "@/lib/auth";
import type { JWTPayload } from "@/types";

export type AuthedRequest = NextRequest & { auth: JWTPayload };

/**
 * Extracts and verifies the Bearer access token from the Authorization header.
 * Returns the decoded payload or null.
 */
export async function getAuthPayload(
  req: NextRequest
): Promise<JWTPayload | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  return verifyAccessToken(token);
}

/**
 * Higher-order helper for API route handlers that require authentication.
 * Usage:
 *   export const GET = withAuth(async (req, payload) => { ... });
 */
export function withAuth(
  handler: (
    req: NextRequest,
    payload: JWTPayload,
    params?: Record<string, string>
  ) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const payload = await getAuthPayload(req);
    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (!isSessionActive(payload.session_id, payload.sub)) {
      return NextResponse.json(
        { error: "Session revoked or expired" },
        { status: 401 }
      );
    }
    const params = context?.params ? await context.params : undefined;
    return handler(req, payload, params);
  };
}

export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
