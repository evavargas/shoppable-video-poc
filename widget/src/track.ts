export type TrackInput =
  | { type: 'view' | 'video_click' | 'story_open'; videoId: string }
  | { type: 'hotspot_click'; videoId: string; productHandle: string }
  | { type: 'add_to_cart'; videoId: string; productHandle: string; value: number; currency: string };

export type Track = (event: TrackInput) => void;

// Per page load, in memory only: no cookie or storage, so no consent banner needed for this id.
export const sessionId = Math.random().toString(36).slice(2, 10);

/**
 * Fire-and-forget analytics. Never throws and never waits: tracking must not slow or break the store.
 *
 * sendBeacon queues the request in the browser so it survives the page being closed or navigated away.
 * We send JSON as `text/plain` on purpose: that is a CORS "simple request", so the browser skips the
 * preflight OPTIONS round trip. The Cloud Function parses the raw body itself.
 */
export function makeTracker(apiBase: string, embeddingId: string): Track {
  const url = `${apiBase}/api/track`;
  return (event) => {
    try {
      const body = JSON.stringify({ ...event, embeddingId, sessionId });
      const queued = navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }));
      if (!queued) {
        void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };
}
