/** A viewer counts as "watching" if their heartbeat is newer than this (2.5 heartbeats of 30 s). */
export const VIEWER_WINDOW_MS = 75_000;
export const HEARTBEAT_MS = 30_000;
export const VIEWER_QUERY_LIMIT = 100;

/** Pure: how many heartbeats are fresh at `now`. Nothing changes in the database when someone silently leaves, so this is re-run on a timer. */
export function countActive(lastSeenMs: number[], now: number, windowMs = VIEWER_WINDOW_MS): number {
  return lastSeenMs.filter((t) => t > 0 && now - t <= windowMs).length;
}

/** The listener is capped, so a full answer means "at least this many". */
export function formatWatching(count: number, queried: number): string {
  return queried >= VIEWER_QUERY_LIMIT ? `${VIEWER_QUERY_LIMIT}+` : String(count);
}

export const HANDLE = /^[\w-]{1,255}$/;
