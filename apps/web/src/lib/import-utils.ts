/**
 * Server-side import parser helpers.
 * Supports CSV, JSON, and Excel (.xlsx) formats.
 */

export interface ImportedActivity {
  source: string;
  occurred_at: string;
  title: string;
  description?: string;
  ticket_number?: string;
  worklog_note?: string;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  activities: ImportedActivity[];
  errors: ImportError[];
}

/** Parse CSV text into ImportedActivity rows */
export function parseActivitiesCsv(text: string): ImportResult {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { activities: [], errors: [{ row: 0, message: "No data rows found" }] };
  }

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/\s+/g, "_")
  );

  const activities: ImportedActivity[] = [];
  const errors: ImportError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? "";
    });
    const result = rowToActivity(obj, i + 1);
    if ("error" in result) {
      errors.push(result.error);
    } else {
      activities.push(result.activity);
    }
  }

  return { activities, errors };
}

/** Parse JSON array / {activities:[]} wrapper into ImportedActivity rows */
export function parseActivitiesJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { activities: [], errors: [{ row: 0, message: "Invalid JSON" }] };
  }

  const rows: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { activities?: unknown })?.activities)
    ? (data as { activities: unknown[] }).activities
    : [];

  if (rows.length === 0) {
    return {
      activities: [],
      errors: [{ row: 0, message: "No activity rows found in JSON" }],
    };
  }

  const activities: ImportedActivity[] = [];
  const errors: ImportError[] = [];
  rows.forEach((row, idx) => {
    const obj: Record<string, string> = {};
    if (typeof row === "object" && row !== null) {
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        obj[k.toLowerCase().replace(/\s+/g, "_")] =
          v === null || v === undefined ? "" : String(v);
      }
    }
    const result = rowToActivity(obj, idx + 1);
    if ("error" in result) {
      errors.push(result.error);
    } else {
      activities.push(result.activity);
    }
  });

  return { activities, errors };
}

/** Parse Excel (.xlsx) buffer into ImportedActivity rows */
export async function parseActivitiesExcel(
  buffer: ArrayBuffer | Uint8Array
): Promise<ImportResult> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const ab = buffer instanceof ArrayBuffer
    ? buffer
    : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  await workbook.xlsx.load(ab as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      activities: [],
      errors: [{ row: 0, message: "Excel file has no worksheets" }],
    };
  }

  const rows: Array<Record<string, string>> = [];
  let headers: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    const cells = row.values as (string | number | null | undefined)[];
    // ExcelJS row.values is 1-indexed; index 0 is undefined
    const cellArr = cells.slice(1).map((c) =>
      c === null || c === undefined ? "" : String(c).trim()
    );

    if (rowNumber === 1) {
      headers = cellArr.map((h) =>
        h.toLowerCase().replace(/\s+/g, "_")
      );
    } else {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = cellArr[i] ?? "";
      });
      rows.push(obj);
    }
  });

  const activities: ImportedActivity[] = [];
  const errors: ImportError[] = [];
  rows.forEach((obj, idx) => {
    const result = rowToActivity(obj, idx + 2);
    if ("error" in result) {
      errors.push(result.error);
    } else {
      activities.push(result.activity);
    }
  });

  return { activities, errors };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_SOURCES = new Set([
  "jira",
  "bitbucket",
  "browser",
  "system",
  "manual",
]);

function rowToActivity(
  obj: Record<string, string>,
  rowNumber: number
):
  | { activity: ImportedActivity }
  | { error: ImportError } {
  const title = (obj["title"] ?? "").trim();
  if (!title) {
    return {
      error: { row: rowNumber, message: "title is required" },
    };
  }

  const occurred_at = (
    obj["occurred_at"] ??
    obj["date"] ??
    ""
  ).trim();
  if (!occurred_at || isNaN(Date.parse(occurred_at))) {
    return {
      error: {
        row: rowNumber,
        message: `occurred_at is missing or not a valid date: "${occurred_at}"`,
      },
    };
  }

  const rawSource = (obj["source"] ?? "manual").trim().toLowerCase();
  const source = VALID_SOURCES.has(rawSource) ? rawSource : "manual";

  return {
    activity: {
      source,
      occurred_at: new Date(occurred_at).toISOString(),
      title,
      description: obj["description"]?.trim() || undefined,
      ticket_number: obj["ticket_number"]?.trim() || undefined,
      worklog_note: obj["worklog_note"]?.trim() || undefined,
    },
  };
}

/**
 * Minimal CSV line parser — handles double-quoted fields with commas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
