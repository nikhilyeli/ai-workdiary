import { NextRequest, NextResponse } from "next/server";
import { withAuth, apiError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { getActivityVersionHistory } from "@/lib/activity-history";
import type { JWTPayload } from "@/types";

// GET /api/activities/:id/history
export const GET = withAuth(
  async (_req: NextRequest, payload: JWTPayload, params): Promise<NextResponse> => {
    const activity = getDb()
      .prepare("SELECT id FROM activities WHERE id = ? AND user_id = ?")
      .get(params?.id, payload.sub) as { id: string } | undefined;
    if (!activity) return apiError("Activity not found", 404);

    const history = getActivityVersionHistory(params?.id ?? "", payload.sub).map(
      (entry) => ({
        ...entry,
        snapshot: JSON.parse(entry.snapshot),
      })
    );
    return NextResponse.json({ history });
  }
);
