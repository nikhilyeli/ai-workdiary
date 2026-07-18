"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth-client";
import type { Activity, ActivityStatus } from "@/types";

const STATUS_COLORS: Record<ActivityStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  reviewed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  skipped: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
};

const SOURCE_ICONS: Record<string, string> = {
  jira: "🎯",
  bitbucket: "🔀",
  browser: "🌐",
  system: "💻",
  manual: "✍️",
};

interface Props {
  activities: Activity[];
  total: number;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
}

interface HistoryEntry {
  id: string;
  version: number;
  action: "created" | "updated" | "deleted";
  created_at: string;
  snapshot: Activity;
}

export default function ActivityList({
  activities,
  total,
  loading,
  error,
  onRefresh,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Activity>>({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"json" | "csv" | "xlsx" | "docx" | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [addingManual, setAddingManual] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: "",
    description: "",
    ticket_number: "",
    occurred_at: new Date().toISOString().slice(0, 16),
  });

  async function saveEdit(activity: Activity) {
    setSaving(true);
    const res = await authFetch(`/api/activities/${activity.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...editValues,
        expected_version: editValues.version ?? activity.version,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(null);
      onRefresh();
      return;
    }
    if (res.status === 409) {
      alert("This activity was updated in another session. Reloading latest data.");
      setEditing(null);
      onRefresh();
    }
  }

  async function exportActivities(format: "json" | "csv" | "xlsx" | "docx") {
    setExporting(format);
    try {
      const res = await authFetch(`/api/activities?format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `activities.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      alert("Unable to export activities right now.");
    } finally {
      setExporting(null);
    }
  }

  async function downloadTemplate(format: "csv" | "xlsx") {
    try {
      const res = await authFetch(`/api/activities/import?format=${format}`);
      if (!res.ok) throw new Error("Template download failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `activities-import-template.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      alert("Unable to download import template.");
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await authFetch("/api/activities/import", {
        method: "POST",
        body,
      });
      const data = await res.json();
      setImportResult({ imported: data.imported ?? 0, errors: data.errors ?? [] });
      if (data.imported > 0) onRefresh();
    } catch {
      setImportResult({ imported: 0, errors: [{ row: 0, message: "Upload failed" }] });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  async function toggleHistory(activityId: string) {
    if (historyOpenFor === activityId) {
      setHistoryOpenFor(null);
      return;
    }
    if (!histories[activityId]) {
      const res = await authFetch(`/api/activities/${activityId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistories((prev) => ({ ...prev, [activityId]: data.history }));
      }
    }
    setHistoryOpenFor(activityId);
  }

  async function updateStatus(activity: Activity, status: ActivityStatus) {
    const res = await authFetch(`/api/activities/${activity.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, expected_version: activity.version }),
    });
    if (res.ok) {
      onRefresh();
      return;
    }
    if (res.status === 409) {
      alert("This activity was updated in another session. Reloading latest data.");
      onRefresh();
    }
  }

  async function createWorklogDraft(activity: Activity) {
    if (!activity.ticket_number) {
      alert("Please add a ticket number before creating a worklog draft");
      return;
    }
    const note = activity.worklog_note || activity.description || activity.title;
    await authFetch("/api/worklogs", {
      method: "POST",
      body: JSON.stringify({
        activity_id: activity.id,
        ticket_number: activity.ticket_number,
        description: note,
      }),
    });
    alert("Worklog draft created! View it in the Worklogs tab.");
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const res = await authFetch("/api/activities", {
      method: "POST",
      body: JSON.stringify({ ...newEntry, source: "manual" }),
    });
    if (res.ok) {
      setAddingManual(false);
      setNewEntry({
        title: "",
        description: "",
        ticket_number: "",
        occurred_at: new Date().toISOString().slice(0, 16),
      });
      onRefresh();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400">
        Loading activities…
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300"
      >
        <p>{error}</p>
        <button
          onClick={onRefresh}
          className="mt-3 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div id="activity-list">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mr-auto">
          {total} total entr{total === 1 ? "y" : "ies"}
        </p>
        {/* Export group */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-zinc-400 mr-1">Export:</span>
          {(["json", "csv", "xlsx", "docx"] as const).map((fmt) => (
            <button
              key={fmt}
              id={`export-${fmt}-btn`}
              onClick={() => void exportActivities(fmt)}
              disabled={exporting !== null}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
        {/* Import button */}
        <button
          onClick={() => { setShowImportPanel((v) => !v); setImportResult(null); }}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
        >
          📂 Import
        </button>
        <button
          id="add-activity-btn"
          onClick={() => setAddingManual(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Add manual entry
        </button>
      </div>

      {/* Import panel */}
      {showImportPanel && (
        <div className="mb-4 rounded-xl bg-white dark:bg-zinc-800 shadow p-4 space-y-3">
          <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">
            Import Activities
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Supported formats: <strong>.csv</strong>, <strong>.json</strong>, <strong>.xlsx</strong>.
            Download a template to see the required columns.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => void downloadTemplate("csv")}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
            >
              ⬇ CSV Template
            </button>
            <button
              onClick={() => void downloadTemplate("xlsx")}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
            >
              ⬇ Excel Template
            </button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Choose file to import:</span>
            <input
              type="file"
              accept=".csv,.json,.xlsx"
              disabled={importing}
              onChange={handleImportFile}
              className="text-sm text-zinc-700 dark:text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-blue-700"
            />
          </label>
          {importing && (
            <p className="text-xs text-zinc-400">Importing…</p>
          )}
          {importResult && (
            <div className={`rounded-lg p-3 text-xs ${importResult.imported > 0 ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"}`}>
              {importResult.imported > 0 && (
                <p>✓ Imported {importResult.imported} activit{importResult.imported === 1 ? "y" : "ies"}.</p>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-1">
                  <p className="font-semibold">Skipped rows:</p>
                  <ul className="list-disc list-inside space-y-0.5 mt-0.5">
                    {importResult.errors.map((e, i) => (
                      <li key={i}>Row {e.row}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setShowImportPanel(false)}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            Close
          </button>
        </div>
      )}

      {/* Add manual entry form */}
      {addingManual && (
        <div className="mb-4 rounded-xl bg-white dark:bg-zinc-800 shadow p-4">
          <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
            Add Manual Entry
          </h3>
          <form onSubmit={submitManual} className="space-y-3">
            <input
              type="text"
              placeholder="Title *"
              required
              value={newEntry.title}
              onChange={(e) =>
                setNewEntry((v) => ({ ...v, title: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Ticket number (e.g. PROJ-123)"
              value={newEntry.ticket_number}
              onChange={(e) =>
                setNewEntry((v) => ({ ...v, ticket_number: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Description"
              rows={3}
              value={newEntry.description}
              onChange={(e) =>
                setNewEntry((v) => ({ ...v, description: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="datetime-local"
              required
              value={newEntry.occurred_at}
              onChange={(e) =>
                setNewEntry((v) => ({ ...v, occurred_at: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setAddingManual(false)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-4xl mb-3">📋</p>
          <p>No activities yet. Add a manual entry or connect a data source.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => (
            <div
              key={a.id}
              className="rounded-xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700 p-4"
            >
              {editing === a.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editValues.title ?? a.title}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, title: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Ticket number"
                    value={editValues.ticket_number ?? a.ticket_number ?? ""}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        ticket_number: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    placeholder="Worklog note"
                    rows={3}
                    value={editValues.worklog_note ?? a.worklog_note ?? ""}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        worklog_note: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={editValues.status ?? a.status}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        status: e.target.value as ActivityStatus,
                      }))
                    }
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                    <option value="skipped">Skipped</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(a)}
                      disabled={saving}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span title={a.source}>
                        {SOURCE_ICONS[a.source] ?? "📌"}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {a.title}
                      </span>
                      {a.ticket_number && (
                        <span className="text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded font-mono">
                          {a.ticket_number}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditing(a.id);
                          setEditValues({ version: a.version });
                        }}
                        className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void toggleHistory(a.id)}
                        className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      >
                        History
                      </button>
                      {a.status !== "approved" && (
                        <button
                          onClick={() => updateStatus(a, "approved")}
                          className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        >
                          Approve
                        </button>
                      )}
                      {a.status === "approved" && (
                        <button
                          onClick={() => createWorklogDraft(a)}
                          className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          → Worklog
                        </button>
                      )}
                    </div>
                  </div>
                  {a.description && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {a.description}
                    </p>
                  )}
                  {a.worklog_note && (
                    <p className="mt-1 text-sm text-blue-600 dark:text-blue-400 italic line-clamp-2">
                      📝 {a.worklog_note}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-zinc-400">
                    {new Date(a.occurred_at).toLocaleString()}
                  </p>
                  {historyOpenFor === a.id && (
                    <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2">
                        Version history
                      </p>
                      <div className="space-y-1">
                        {(histories[a.id] ?? []).map((entry) => (
                          <p
                            key={entry.id}
                            className="text-xs text-zinc-500 dark:text-zinc-400"
                          >
                            v{entry.version} · {entry.action} ·{" "}
                            {new Date(entry.created_at).toLocaleString()}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
