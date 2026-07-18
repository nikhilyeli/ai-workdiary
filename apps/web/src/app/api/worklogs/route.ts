import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { withAuth, apiError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { toCsv, toExcel, toWord } from "@/lib/export-utils";
import type { JWTPayload } from "@/types";

// GET /api/worklogs?logged=0|1&page=1&limit=50
export const GET = withAuth(
  async (req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    const url = new URL(req.url);
    const logged = url.searchParams.get("logged");
    const format = url.searchParams.get("format");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions: string[] = ["wd.user_id = ?"];
    const params: unknown[] = [payload.sub];

    if (logged === "0" || logged === "1") {
      conditions.push("wd.logged = ?");
      params.push(parseInt(logged));
    }

    const where = conditions.join(" AND ");
    const total = (
      db.prepare(`SELECT COUNT(*) as c FROM worklog_drafts wd WHERE ${where}`)
        .get(...params) as { c: number }
    ).c;

    if (format === "json" || format === "csv" || format === "xlsx" || format === "docx") {
      const rows = db
        .prepare(
          `SELECT wd.*, a.title as activity_title, a.occurred_at, a.source
           FROM worklog_drafts wd
           JOIN activities a ON a.id = wd.activity_id
           WHERE ${where}
           ORDER BY a.occurred_at DESC LIMIT 5000`
        )
        .all(...params) as Array<Record<string, unknown>>;

      const columns = [
        "id",
        "activity_id",
        "ticket_number",
        "description",
        "time_spent",
        "logged",
        "activity_title",
        "source",
        "occurred_at",
        "created_at",
        "updated_at",
      ];

      if (format === "json") {
        return NextResponse.json(
          {
            exported_at: new Date().toISOString(),
            total: rows.length,
            drafts: rows,
          },
          {
            headers: {
              "Content-Disposition": 'attachment; filename="worklogs.json"',
            },
          }
        );
      }

      if (format === "csv") {
        return new NextResponse(toCsv(rows, columns), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="worklogs.csv"',
          },
        });
      }

      if (format === "xlsx") {
        const buf = await toExcel(rows, columns, "Worklogs");
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="worklogs.xlsx"',
          },
        });
      }

      // format === "docx"
      const buf = await toWord("Worklog Drafts Export", rows, columns);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="worklogs.docx"',
        },
      });
    }

    const drafts = db
      .prepare(
        `SELECT wd.*, a.title as activity_title, a.occurred_at, a.source
         FROM worklog_drafts wd
         JOIN activities a ON a.id = wd.activity_id
         WHERE ${where}
         ORDER BY a.occurred_at DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return NextResponse.json({
      drafts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }
);

// POST /api/worklogs – generate a worklog draft from an approved activity
export const POST = withAuth(
  async (req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    let body: {
      activity_id?: string;
      ticket_number?: string;
      description?: string;
      time_spent?: string;
    };
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body");
    }

    const { activity_id, ticket_number, description, time_spent } = body;

    if (!activity_id) return apiError("activity_id is required");
    if (!ticket_number || ticket_number.trim().length === 0) {
      return apiError("ticket_number is required");
    }
    if (!description || description.trim().length === 0) {
      return apiError("description is required");
    }

    const db = getDb();
    const activity = db
      .prepare(
        "SELECT * FROM activities WHERE id = ? AND user_id = ? AND status = 'approved'"
      )
      .get(activity_id, payload.sub) as
      | { id: string; ticket_number: string | null; worklog_note: string | null }
      | undefined;

    if (!activity) {
      return apiError(
        "Activity not found or not yet approved. Approve the activity before creating a worklog draft.",
        422
      );
    }

    // Validate ISO 8601 duration if provided (e.g. PT1H30M)
    if (time_spent && !/^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/.test(time_spent)) {
      return apiError("time_spent must be a valid ISO 8601 duration (e.g. PT1H30M)");
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO worklog_drafts (id, user_id, activity_id, ticket_number, description, time_spent)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, payload.sub, activity_id, ticket_number.trim(), description.trim(), time_spent ?? null);

    const draft = db.prepare("SELECT * FROM worklog_drafts WHERE id = ?").get(id);
    return NextResponse.json({ draft }, { status: 201 });
  }
);

// PATCH /api/worklogs?id=<draftId> – mark a draft as logged (user confirmed submission)
export const PATCH = withAuth(
  async (req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    const url = new URL(req.url);
    const draftId = url.searchParams.get("id");
    if (!draftId) return apiError("Provide ?id=<draftId>");

    const db = getDb();
    const draft = db
      .prepare("SELECT * FROM worklog_drafts WHERE id = ? AND user_id = ?")
      .get(draftId, payload.sub) as { id: string; logged: number } | undefined;
    if (!draft) return apiError("Draft not found", 404);
    if (draft.logged) return apiError("Draft already marked as logged");

    db.prepare(
      "UPDATE worklog_drafts SET logged = 1, updated_at = datetime('now') WHERE id = ?"
    ).run(draftId);

    const updated = db
      .prepare("SELECT * FROM worklog_drafts WHERE id = ?")
      .get(draftId);
    return NextResponse.json({ draft: updated });
  }
);
