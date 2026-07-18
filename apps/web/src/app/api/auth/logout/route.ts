import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { revokeSession } from "@/lib/auth";
import type { JWTPayload } from "@/types";

export const POST = withAuth(
  async (_req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    revokeSession(payload.session_id);
    return NextResponse.json({ message: "Logged out" });
  }
);
