"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/auth-client";

interface SessionInfo {
  id: string;
  device_label: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  is_current: boolean;
}

export default function SessionManager() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await authFetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
        setError(null);
      } else {
        setError("Could not load sessions.");
      }
    } catch {
      setError("Could not load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchSessions();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchSessions]);

  async function revokeSession(id: string, isCurrent: boolean) {
    const msg = isCurrent
      ? "Sign out from this device?"
      : "Revoke this session?";
    if (!confirm(msg)) return;
    await authFetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    setLoading(true);
    void fetchSessions();
    if (isCurrent) {
      window.location.assign("/login");
    }
  }

  async function revokeAll() {
    if (!confirm("Sign out from all devices?")) return;
    await authFetch("/api/sessions?all=1", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div id="session-manager">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">
          Active Sessions
        </h2>
        <button
          onClick={revokeAll}
          className="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          Sign out all devices
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-400">
          Loading sessions…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300"
        >
          <p>{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              void fetchSessions();
            }}
            className="mt-3 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl bg-white dark:bg-zinc-800 shadow-sm border p-4 ${
                s.is_current
                  ? "border-blue-300 dark:border-blue-700"
                  : "border-zinc-100 dark:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      🖥 {s.device_label}
                    </span>
                    {s.is_current && (
                      <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                        This device
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Created: {new Date(s.created_at).toLocaleString()} · Last
                    used: {new Date(s.last_used_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Expires: {new Date(s.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeSession(s.id, s.is_current)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  {s.is_current ? "Sign out" : "Revoke"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-800 dark:text-blue-300">
        <strong>Security tip:</strong> Regularly review and remove sessions from
        devices you no longer use. Sessions expire automatically after 30 days
        of inactivity.
      </div>
    </div>
  );
}
