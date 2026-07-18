/**
 * Playwright global setup — pre-warms Next.js Turbopack route compilation
 * before any tests run, so the first test doesn't hit a cold compilation
 * timeout on the 5-second URL assertion.
 */
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://localhost:3000";

  const routes = [
    "/login",
    "/register",
    "/dashboard",
    "/api/auth/login",
  ];

  for (const route of routes) {
    try {
      await fetch(`${baseURL}${route}`, {
        signal: AbortSignal.timeout(15_000),
        // Trigger compilation without requiring auth
      });
    } catch {
      // Ignore errors; tests will handle connectivity
    }
  }
}
