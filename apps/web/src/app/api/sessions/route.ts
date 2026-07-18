import { NextRequest, NextResponse } from "next/server";
import { withAuth, apiError } from "@/lib/api-helpers";
import {
  getActiveSessions,
  revokeSessionForUser,
  revokeAllUserSessions,
} from "@/lib/auth";
import type { JWTPayload } from "@/types";

// GET /api/sessions – list active sessions for the current user
export const GET = withAuth(
  async (_req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    const sessions = getActiveSessions(payload.sub);
    // Never expose refresh token hashes to the client
    const safe = sessions.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      device_label: s.device_label,
      created_at: s.created_at,
      last_used_at: s.last_used_at,
      expires_at: s.expires_at,
      is_current: s.id === payload.session_id,
    }));
    return NextResponse.json({ sessions: safe });
  }
);

// DELETE /api/sessions?id=<sessionId>  – revoke one session
// DELETE /api/sessions?all=1           – revoke all sessions for this user
export const DELETE = withAuth(
  async (req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    const url = new URL(req.url);
    const all = url.searchParams.get("all");
    const targetId = url.searchParams.get("id");

    if (all === "1") {
      revokeAllUserSessions(payload.sub);
      return NextResponse.json({ message: "All sessions revoked" });
    }

    if (!targetId) {
      return apiError("Provide ?id=<sessionId> or ?all=1");
    }

    if (!revokeSessionForUser(targetId, payload.sub)) {
      return apiError("Session not found", 404);
    }
    return NextResponse.json({ message: "Session revoked" });
  }
);
