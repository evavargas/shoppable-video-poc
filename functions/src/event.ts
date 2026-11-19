export const EVENT_TYPES = ['view', 'video_click', 'story_open', 'hotspot_click', 'reaction', 'add_to_cart'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface TrackEvent {
  type: EventType;
  embeddingId: string;
  videoId: string;
  sessionId: string;
  // hotspot_click and add_to_cart
  productHandle?: string;
  // reaction only: how many hearts this batch stands for
  count?: number;
  // add_to_cart only
  value?: number;
  currency?: string;
}

const ID = /^[\w-]{1,64}$/;
const HANDLE = /^[\w-]{1,255}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MAX_VALUE = 100_000;
export const MAX_REACTION_COUNT = 50;

/**
 * The request body is untrusted. Returns a clean event or null; unknown fields are dropped,
 * so nothing the browser sends can end up in Firestore unchecked.
 */
export function parseEvent(raw: unknown): TrackEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { type, embeddingId, videoId, sessionId } = r;
  if (!EVENT_TYPES.includes(type as EventType)) return null;
  if (![embeddingId, videoId, sessionId].every((v) => typeof v === 'string' && ID.test(v))) return null;

  const base = { type: type as EventType, embeddingId: embeddingId as string, videoId: videoId as string, sessionId: sessionId as string };
  if (base.type === 'view' || base.type === 'video_click' || base.type === 'story_open') return base;

  if (base.type === 'reaction') {
    // One event per flushed batch of hearts; the count keeps the dashboard honest without one event per tap.
    const { count } = r;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_REACTION_COUNT) return null;
    return { ...base, count };
  }

  const { productHandle, value, currency } = r;
  if (typeof productHandle !== 'string' || !HANDLE.test(productHandle)) return null;
  if (base.type === 'hotspot_click') return { ...base, productHandle };
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) return null;
  if (typeof currency !== 'string' || !CURRENCY.test(currency)) return null;
  return { ...base, productHandle, value, currency };
}

/** Which counter on stats/{embeddingId} each event type bumps. */
export const COUNTER: Record<EventType, string> = {
  view: 'views',
  video_click: 'clicks',
  story_open: 'storyOpens',
  hotspot_click: 'hotspotClicks',
  reaction: 'reactions',
  add_to_cart: 'addToCarts',
};
