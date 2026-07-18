"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/auth-client";

interface Draft {
  id: string;
  ticket_number: string;
  description: string;
  time_spent: string | null;
  logged: number;
  activity_title: string;
  occurred_at: string;
  source: string;
  created_at: string;
}

export default function WorklogDraftList() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"json" | "csv" | "xlsx" | "docx" | null>(null);
  const [filter, setFilter] = useState<"all" | "0" | "1">("0");

  const fetchDrafts = useCallback(async () => {
    const q = filter === "all" ? "" : `?logged=${filter}`;
    try {
      const res = await authFetch(`/api/worklogs${q}`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts);
        setError(null);
      } else {
        setError("Could not load worklog drafts.");
      }
    } catch {
      setError("Could not load worklog drafts.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchDrafts();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchDrafts]);

  async function markLogged(id: string) {
    const confirmed = confirm(
      "Mark this worklog draft as submitted to Atlassian Worklog Pro?"
    );
    if (!confirmed) return;
    const res = await authFetch(`/api/worklogs?id=${id}`, { method: "PATCH" });
    if (res.ok) {
      setLoading(true);
      void fetchDrafts();
    }
  }

  async function exportDrafts(format: "json" | "csv" | "xlsx" | "docx") {
    setExporting(format);
    try {
      const q = filter === "all" ? "" : `&logged=${filter}`;
      const res = await authFetch(`/api/worklogs?format=${format}${q}`);
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `worklogs.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      alert("Unable to export worklog drafts right now.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div id="worklog-list">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-zinc-500">Show:</span>
        {(["0", "1", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
            }`}
          >
            {f === "0" ? "Pending" : f === "1" ? "Logged" : "All"}
          </button>
        ))}
        <button
          onClick={() => void exportDrafts("json")}
          disabled={exporting !== null}
          className="ml-auto rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
        >
          Export JSON
        </button>
        <button
          onClick={() => void exportDrafts("csv")}
          disabled={exporting !== null}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
        >
          Export CSV
        </button>
        <button
          onClick={() => void exportDrafts("xlsx")}
          disabled={exporting !== null}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
        >
          Export Excel
        </button>
        <button
          onClick={() => void exportDrafts("docx")}
          disabled={exporting !== null}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
        >
          Export Word
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-400">Loading drafts…</div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300"
        >
          <p>{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              void fetchDrafts();
            }}
            className="mt-3 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-4xl mb-3">📝</p>
          <p>No worklog drafts yet. Approve activities and generate drafts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div
              key={d.id}
              className={`rounded-xl bg-white dark:bg-zinc-800 shadow-sm border p-4 ${
                d.logged
                  ? "border-green-200 dark:border-green-800"
                  : "border-zinc-100 dark:border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded font-mono">
                      {d.ticket_number}
                    </span>
                    {d.time_spent && (
                      <span className="text-xs text-zinc-500">
                        ⏱ {d.time_spent}
                      </span>
                    )}
                    {d.logged ? (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                        ✓ Logged
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                    {d.description}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    From: {d.activity_title} ·{" "}
                    {new Date(d.occurred_at).toLocaleDateString()}
                  </p>
                </div>
                {!d.logged && (
                  <button
                    onClick={() => markLogged(d.id)}
                    className="flex-shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
                  >
                    Mark logged
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
        <strong>⚠️ Important:</strong> AI Work Diary is an orchestrator and
        reviewer — it does not automatically submit worklogs. After reviewing
        these drafts, manually enter them into Atlassian Worklog Pro and click
        &quot;Mark logged&quot; to confirm.
      </div>
    </div>
  );
}
