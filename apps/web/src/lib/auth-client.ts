"use client";

import type { AuthTokens } from "@/types";

const ACCESS_KEY = "wd_access_token";
const REFRESH_KEY = "wd_refresh_token";
const SESSION_KEY = "wd_session_id";
const DEVICE_KEY = "wd_device_label";
let activeRefreshPromise: Promise<string | null> | null = null;

function generateDeviceLabel(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
  const browser = ua.includes("Atlas")
    ? "Atlas"
    : ua.includes("Comet")
    ? "Comet"
    : ua.includes("OPR/") || ua.includes("Opera")
    ? "Opera"
    : ua.includes("Firefox/")
    ? "Firefox"
    : ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Chrome/")
    ? "Chrome"
    : ua.includes("Safari/")
    ? "Safari"
    : "Unknown Browser";
  const platform = ua.includes("Windows")
    ? "Windows"
    : ua.includes("Mac")
    ? "Mac"
    : ua.includes("Linux")
    ? "Linux"
    : ua.includes("Android")
    ? "Android"
    : ua.includes("iPhone") || ua.includes("iPad")
    ? "iOS"
    : "Unknown";
  return `${browser} on ${platform} - ${new Date().toLocaleDateString()}`;
}

export function getDeviceLabel(): string {
  let label =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(DEVICE_KEY)
      : null;
  if (!label) {
    label = generateDeviceLabel();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DEVICE_KEY, label);
    }
  }
  return label;
}

export function saveTokens(tokens: AuthTokens, sessionId: string): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(SESSION_KEY, sessionId);
}

export function getAccessToken(): string | null {
  return typeof localStorage !== "undefined"
    ? localStorage.getItem(ACCESS_KEY)
    : null;
}

function getRefreshToken(): string | null {
  return typeof localStorage !== "undefined"
    ? localStorage.getItem(REFRESH_KEY)
    : null;
}

function getSessionId(): string | null {
  return typeof localStorage !== "undefined"
    ? localStorage.getItem(SESSION_KEY)
    : null;
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function isTokenExpiredSoon(accessToken: string): boolean {
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    const expiresAt = payload.exp * 1000;
    // Refresh if less than 2 minutes remain
    return Date.now() > expiresAt - 2 * 60 * 1000;
  } catch {
    return true;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (activeRefreshPromise) return activeRefreshPromise;

  activeRefreshPromise = (async () => {
  const refreshToken = getRefreshToken();
  const sessionId = getSessionId();
  if (!refreshToken || !sessionId) return null;

  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, refresh_token: refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const { tokens } = await res.json();
  saveTokens(tokens, sessionId);
  return tokens.accessToken;
  })();

  try {
    return await activeRefreshPromise;
  } finally {
    activeRefreshPromise = null;
  }
}

/** Authenticated fetch – auto-refreshes token if near expiry */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token = getAccessToken();

  if (!token) {
    clearTokens();
    window.location.assign("/login");
    throw new Error("Not authenticated");
  }

  if (isTokenExpiredSoon(token)) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      window.location.assign("/login");
      throw new Error("Session expired");
    }
    token = refreshed;
  }

  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type for FormData — browser sets it automatically
      // (including the multipart boundary)
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
    },
  });

  if (response.status === 401) {
    clearTokens();
    window.location.assign("/login");
    throw new Error("Unauthorized");
  }

  return response;
}
