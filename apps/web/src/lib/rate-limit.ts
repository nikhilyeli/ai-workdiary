import { NextRequest, NextResponse } from "next/server";

type Bucket = { hits: number[] };

const rateBuckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function enforceRateLimit(
  req: NextRequest,
  key: string,
  maxRequests: number,
  windowMs: number
): NextResponse | null {
  // Rate limiting only applies in production to avoid interfering with
  // development reloads or test suites that share a server process.
  if (process.env.NODE_ENV !== "production") return null;

  const now = Date.now();
  const ip = getClientIp(req);
  const bucketKey = `${key}:${ip}`;

  const existing = rateBuckets.get(bucketKey) ?? { hits: [] };
  existing.hits = existing.hits.filter((ts) => now - ts < windowMs);

  if (existing.hits.length >= maxRequests) {
    const oldestHit = existing.hits[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - oldestHit)) / 1000)
    );
    rateBuckets.set(bucketKey, existing);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      }
    );
  }

  existing.hits.push(now);
  rateBuckets.set(bucketKey, existing);
  return null;
}
