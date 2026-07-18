import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import type { Activity, ActivityHistoryAction, ActivityVersion } from "@/types";

export function recordActivityVersion(
  activity: Activity,
  action: ActivityHistoryAction
): void {
  getDb()
    .prepare(
      `INSERT INTO activity_versions
         (id, activity_id, user_id, version, action, snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      uuidv4(),
      activity.id,
      activity.user_id,
      activity.version,
      action,
      JSON.stringify(activity)
    );
}

export function getActivityVersionHistory(
  activityId: string,
  userId: string
): ActivityVersion[] {
  return getDb()
    .prepare(
      `SELECT *
       FROM activity_versions
       WHERE activity_id = ? AND user_id = ?
       ORDER BY created_at DESC, version DESC`
    )
    .all(activityId, userId) as ActivityVersion[];
}
