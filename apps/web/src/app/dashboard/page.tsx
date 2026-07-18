"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { authFetch, clearTokens, getAccessToken } from "@/lib/auth-client";
import ActivityList from "@/components/dashboard/ActivityList";
import WorklogDraftList from "@/components/dashboard/WorklogDraftList";
import SessionManager from "@/components/dashboard/SessionManager";
import type { Activity } from "@/types";

// Dynamically import OnboardingTour to avoid SSR document errors (intro.js)
const OnboardingTour = dynamic(
  () => import("@/components/dashboard/OnboardingTour"),
  { ssr: false }
);

type Tab = "activities" | "worklogs" | "sessions";

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("activities");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(
    typeof window !== "undefined" && !localStorage.getItem("wd_toured")
  );

  const fetchActivities = useCallback(async () => {
    try {
      const res = await authFetch("/api/activities?limit=50");
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
        setTotalActivities(data.pagination.total);
        setError(null);
      } else {
        setError("Could not load activities right now.");
      }
    } catch {
      setError("Could not load activities right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchActivities();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchActivities]);

  function refreshActivities() {
    setLoading(true);
    void fetchActivities();
  }

  function handleLogout() {
    // Fire-and-forget logout: use plain fetch (not authFetch) to avoid the
    // authFetch 401-redirect side-effect racing against the sign-in flow.
    const token = getAccessToken();
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      }).catch(() => {});
    }
    clearTokens();
    router.push("/login");
  }

  function dismissTour() {
    localStorage.setItem("wd_toured", "1");
    setShowTour(false);
  }

  const pendingCount = activities.filter((a) => a.status === "pending").length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {showTour && <OnboardingTour onDone={dismissTour} />}

      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              📓 AI Work Diary
            </span>
            {pendingCount > 0 && (
              <span
                id="pending-badge"
                className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-semibold px-2 py-0.5"
              >
                {pendingCount} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTour(true)}
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              title="Show help tour"
            >
              ?
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 mt-6">
        <div className="flex gap-1 bg-white dark:bg-zinc-800 rounded-xl p-1 shadow-sm w-fit">
          {(["activities", "worklogs", "sessions"] as Tab[]).map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-blue-600 text-white shadow"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              {t === "activities" ? "📋 Activities" : t === "worklogs" ? "📝 Worklogs" : "🖥 Sessions"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {tab === "activities" && (
          <ActivityList
            activities={activities}
            total={totalActivities}
            loading={loading}
            error={error}
            onRefresh={refreshActivities}
          />
        )}
        {tab === "worklogs" && <WorklogDraftList />}
        {tab === "sessions" && <SessionManager />}
      </main>
    </div>
  );
}
