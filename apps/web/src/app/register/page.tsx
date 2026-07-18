"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTokens, getDeviceLabel, getApiUrl } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(getApiUrl("/api/auth/register"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-label": getDeviceLabel(),
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Registration failed");
      return;
    }

    saveTokens(data.tokens, data.session_id ?? "");
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">
          Create Account
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          AI Work Diary – your personal worklog orchestrator
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm
                         bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm
                         bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Password{" "}
              <span className="text-zinc-400 font-normal">(min 10 chars)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm
                         bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{" "}
          <a
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
