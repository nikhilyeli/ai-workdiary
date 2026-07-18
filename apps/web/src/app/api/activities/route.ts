import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { withAuth, apiError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { recordActivityVersion } from "@/lib/activity-history";
import { toCsv, toExcel, toWord } from "@/lib/export-utils";
import type {
  Activity,
  JWTPayload,
  ActivityStatus,
  ActivitySource,
} from "@/types";

const VALID_SOURCES: ActivitySource[] = [
  "jira", "bitbucket", "browser", "system", "manual",
];
const VALID_STATUSES: ActivityStatus[] = [
  "pending", "reviewed", "approved", "skipped",
];

// GET /api/activities?from=ISO&to=ISO&status=pending&source=jira&page=1&limit=50
export const GET = withAuth(
  async (req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const status = url.searchParams.get("status");
    const source = url.searchParams.get("source");
    const format = url.searchParams.get("format");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions: string[] = ["user_id = ?"];
    const params: unknown[] = [payload.sub];

    if (from) {
      conditions.push("occurred_at >= ?");
      params.push(from);
    }
    if (to) {
      conditions.push("occurred_at <= ?");
      params.push(to);
    }
    if (status && VALID_STATUSES.includes(status as ActivityStatus)) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (source && VALID_SOURCES.includes(source as ActivitySource)) {
      conditions.push("source = ?");
      params.push(source);
    }

    const where = conditions.join(" AND ");
    const total = (
      db.prepare(`SELECT COUNT(*) as c FROM activities WHERE ${where}`).get(...params) as { c: number }
    ).c;

    if (format === "json" || format === "csv" || format === "xlsx" || format === "docx") {
      const rows = db
        .prepare(
          `SELECT * FROM activities WHERE ${where}
           ORDER BY occurred_at DESC LIMIT 5000`
        )
        .all(...params) as Array<Record<string, unknown>>;

      if (format === "json") {
        return NextResponse.json(
          {
            exported_at: new Date().toISOString(),
            total: rows.length,
            activities: rows,
          },
          {
            headers: {
              "Content-Disposition": 'attachment; filename="activities.json"',
            },
          }
        );
      }

      const columns = [
        "id",
        "source",
        "occurred_at",
        "title",
        "description",
        "status",
        "ticket_number",
        "worklog_note",
        "version",
        "created_at",
        "updated_at",
      ];

      if (format === "csv") {
        const csv = toCsv(rows, columns);
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="activities.csv"',
          },
        });
      }

      if (format === "xlsx") {
        const buf = await toExcel(rows, columns, "Activities");
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="activities.xlsx"',
          },
        });
      }

      // format === "docx"
      const buf = await toWord("Activities Export", rows, columns);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="activities.docx"',
        },
      });
    }

    const activities = db
      .prepare(
        `SELECT * FROM activities WHERE ${where}
         ORDER BY occurred_at DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return NextResponse.json({
      activities,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }
);

// POST /api/activities – create a manual activity entry
export const POST = withAuth(
  async (req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    let body: {
      source?: string;
      occurred_at?: string;
      title?: string;
      description?: string;
      metadata?: unknown;
      ticket_number?: string;
    };
    try {
      body = await req.json();
    } catch {
      return apiError("Invalid JSON body");
    }

    const { source, occurred_at, title, description, metadata, ticket_number } = body;

    if (!title || title.trim().length === 0) {
      return apiError("title is required");
    }
    if (!occurred_at || isNaN(Date.parse(occurred_at))) {
      return apiError("occurred_at must be a valid ISO 8601 date");
    }
    if (!source || !VALID_SOURCES.includes(source as ActivitySource)) {
      return apiError(`source must be one of: ${VALID_SOURCES.join(", ")}`);
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(
      `INSERT INTO activities
         (id, user_id, source, occurred_at, title, description, metadata, ticket_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      payload.sub,
      source,
      occurred_at,
      title.trim(),
      description?.trim() ?? null,
      metadata ? JSON.stringify(metadata) : null,
      ticket_number?.trim() ?? null
    );

    const activity = db
      .prepare("SELECT * FROM activities WHERE id = ?")
      .get(id) as Activity;
    recordActivityVersion(activity, "created");
    return NextResponse.json({ activity }, { status: 201 });
  }
);
