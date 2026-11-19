export const LIVE_STATUSES = ['live', 'scheduled', 'ended'] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

/** The status field is written by the host; anything unexpected counts as "ended" so a typo can never show a fake live. */
export function normalizeStatus(value: unknown): LiveStatus {
  return LIVE_STATUSES.includes(value as LiveStatus) ? (value as LiveStatus) : 'ended';
}
