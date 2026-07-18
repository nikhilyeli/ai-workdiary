import { NextRequest, NextResponse } from "next/server";
import { withAuth, apiError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { recordActivityVersion } from "@/lib/activity-history";
import type { Activity, JWTPayload, ActivityStatus } from "@/types";

const VALID_STATUSES: ActivityStatus[] = [
  "pending", "reviewed", "approved", "skipped",
];

// GET /api/activities/:id
export const GET = withAuth(
  async (_req: NextRequest, payload: JWTPayload, params): Promise<NextResponse> => {
    const db = getDb();
    const activity = db
      .prepare("SELECT * FROM activities WHERE id = ? AND user_id = ?")
      .get(params?.id, payload.sub);
    if (!activity) return apiError("Activity not found", 404);
    return NextResponse.json({ activity });
  }
);

// PATCH /api/activities/:id – review / edit an activity entry
export const PATCH = withAuth(
  async (req: NextRequest, payload: JWTPayload, params): Promise<NextResponse> => {
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM activities WHERE id = ? AND user_id = ?")
      .get(params?.id, payload.sub) as
      | Activity
      | undefined;
    if (!existing) return apiError("Activity not found", 404);

    let body: {
      title?: string;
      description?: string;
      ticket_number?: string;
      worklog_note?: string;
      status?: string;
      expected_version?: number;
    };
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body");
    }

    const { title, description, ticket_number, worklog_note, status, expected_version } = body;

    if (!Number.isInteger(expected_version) || (expected_version ?? 0) < 1) {
      return apiError("expected_version must be a positive integer");
    }

    // Once approved, only allow un-approving back to reviewed
    if (existing.status === "approved" && status && status !== "reviewed") {
      return apiError(
        "Approved activities can only be moved back to 'reviewed' status"
      );
    }

    if (status && !VALID_STATUSES.includes(status as ActivityStatus)) {
      return apiError(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    const updates: string[] = ["updated_at = datetime('now')", "version = version + 1"];
    const vals: unknown[] = [];

    if (title !== undefined) { updates.push("title = ?"); vals.push(title.trim()); }
    if (description !== undefined) { updates.push("description = ?"); vals.push(description.trim()); }
    if (ticket_number !== undefined) { updates.push("ticket_number = ?"); vals.push(ticket_number.trim()); }
    if (worklog_note !== undefined) { updates.push("worklog_note = ?"); vals.push(worklog_note.trim()); }
    if (status !== undefined) { updates.push("status = ?"); vals.push(status); }

    if (updates.length === 1) return apiError("No fields to update");

    db.prepare(
      `UPDATE activities
       SET ${updates.join(", ")}
       WHERE id = ? AND user_id = ? AND version = ?`
    ).run(...vals, params?.id, payload.sub, expected_version);

    const updated = db
      .prepare("SELECT * FROM activities WHERE id = ? AND user_id = ?")
      .get(params?.id, payload.sub) as Activity | undefined;

    if (!updated) return apiError("Activity not found", 404);

    if (updated.version === existing.version) {
      return NextResponse.json(
        {
          error: "Conflict: this activity was updated elsewhere",
          activity: updated,
        },
        { status: 409 }
      );
    }

    recordActivityVersion(updated, "updated");
    return NextResponse.json({ activity: updated });
  }
);

// DELETE /api/activities/:id – remove a non-approved activity
export const DELETE = withAuth(
  async (_req: NextRequest, payload: JWTPayload, params): Promise<NextResponse> => {
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM activities WHERE id = ? AND user_id = ?")
      .get(params?.id, payload.sub) as Activity | undefined;
    if (!existing) return apiError("Activity not found", 404);
    if (existing.status === "approved") {
      return apiError("Cannot delete an approved activity", 403);
    }
    recordActivityVersion(existing, "deleted");
    db.prepare("DELETE FROM activities WHERE id = ?").run(params?.id);
    return NextResponse.json({ message: "Activity deleted" });
  }
);
