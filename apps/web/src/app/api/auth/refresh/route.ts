import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken } from "@/lib/auth";
import { apiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { session_id?: string; refresh_token?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const { session_id, refresh_token } = body;
  if (!session_id || !refresh_token) {
    return apiError("session_id and refresh_token are required", 400);
  }

  const tokens = await rotateRefreshToken(session_id, refresh_token);
  if (!tokens) {
    return apiError("Invalid or expired refresh token", 401);
  }

  return NextResponse.json({ tokens });
}
