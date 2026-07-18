import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { withAuth, apiError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { recordActivityVersion } from "@/lib/activity-history";
import {
  parseActivitiesCsv,
  parseActivitiesJson,
  parseActivitiesExcel,
} from "@/lib/import-utils";
import { toCsv, toExcel } from "@/lib/export-utils";
import type { Activity, JWTPayload } from "@/types";

// ── POST /api/activities/import ──────────────────────────────────────────────
// Body: multipart/form-data with field "file" (.csv, .json, .xlsx)
export const POST = withAuth(
  async (req: NextRequest, payload: JWTPayload): Promise<NextResponse> => {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return apiError("Request must be multipart/form-data with a 'file' field");
    }

    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return apiError("'file' field is required");
    }

    const fileName =
      "name" in file ? String((file as File).name).toLowerCase() : "upload";
    const arrayBuffer = await file.arrayBuffer();

    let parseResult;
    if (fileName.endsWith(".xlsx")) {
      parseResult = await parseActivitiesExcel(arrayBuffer);
    } else if (fileName.endsWith(".json")) {
      parseResult = parseActivitiesJson(
        new TextDecoder().decode(arrayBuffer)
      );
    } else {
      // Default: treat as CSV (also handles .csv)
      parseResult = parseActivitiesCsv(
        new TextDecoder().decode(arrayBuffer)
      );
    }

    const { activities: parsed, errors } = parseResult;

    if (parsed.length === 0) {
      return NextResponse.json(
        {
          imported: 0,
          errors,
          message: "No valid rows to import",
        },
        { status: 422 }
      );
    }

    const db = getDb();
    const inserted: Activity[] = [];

    const insertStmt = db.prepare(
      `INSERT INTO activities
         (id, user_id, source, occurred_at, title, description, ticket_number, worklog_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = db.transaction(() => {
      for (const row of parsed) {
        const id = uuidv4();
        insertStmt.run(
          id,
          payload.sub,
          row.source ?? "manual",
          row.occurred_at,
          row.title.trim(),
          row.description?.trim() ?? null,
          row.ticket_number?.trim() ?? null,
          row.worklog_note?.trim() ?? null
        );
        const activity = db
          .prepare("SELECT * FROM activities WHERE id = ?")
          .get(id) as Activity;
        inserted.push(activity);
        recordActivityVersion(activity, "created");
      }
    });

    insertMany();

    return NextResponse.json(
      {
        imported: inserted.length,
        errors,
        activities: inserted,
      },
      { status: 201 }
    );
  }
);

// ── GET /api/activities/import/template?format=csv|xlsx ──────────────────────
// Returns a blank import template file users can fill in.
export const GET = withAuth(
  async (req: NextRequest): Promise<NextResponse> => {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "csv";

    const columns = [
      "source",
      "occurred_at",
      "title",
      "description",
      "ticket_number",
      "worklog_note",
    ];

    const sampleRow: Record<string, unknown> = {
      source: "manual",
      occurred_at: new Date().toISOString(),
      title: "Example task title",
      description: "Optional description",
      ticket_number: "PROJ-123",
      worklog_note: "Worked on feature X",
    };

    if (format === "xlsx") {
      const buf = await toExcel([sampleRow], columns, "Import Template");
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="activities-import-template.xlsx"',
        },
      });
    }

    // Default: CSV
    const csv = toCsv([sampleRow], columns);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="activities-import-template.csv"',
      },
    });
  }
);
