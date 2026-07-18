export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  device_label: string;
  refresh_token_hash: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

export type ActivitySource = "jira" | "bitbucket" | "browser" | "system" | "manual";
export type ActivityStatus = "pending" | "reviewed" | "approved" | "skipped";

export interface Activity {
  id: string;
  user_id: string;
  source: ActivitySource;
  occurred_at: string;
  title: string;
  description: string | null;
  metadata: string | null; // JSON string
  status: ActivityStatus;
  ticket_number: string | null;
  worklog_note: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type ActivityHistoryAction = "created" | "updated" | "deleted";

export interface ActivityVersion {
  id: string;
  activity_id: string;
  user_id: string;
  version: number;
  action: ActivityHistoryAction;
  snapshot: string;
  created_at: string;
}

export interface WorklogDraft {
  id: string;
  user_id: string;
  activity_id: string;
  ticket_number: string;
  description: string;
  time_spent: string | null; // ISO 8601 duration e.g. "PT1H30M"
  logged: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  session_id: string;
  iat?: number;
  exp?: number;
}
