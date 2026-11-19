export const EVENT_TYPES = ['view', 'video_click', 'add_to_cart'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface TrackEvent {
  type: EventType;
  embeddingId: string;
  videoId: string;
  sessionId: string;
  // add_to_cart only
  productHandle?: string;
  value?: number;
  currency?: string;
}

const ID = /^[\w-]{1,64}$/;
const HANDLE = /^[\w-]{1,255}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MAX_VALUE = 100_000;

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
  if (base.type !== 'add_to_cart') return base;

  const { productHandle, value, currency } = r;
  if (typeof productHandle !== 'string' || !HANDLE.test(productHandle)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) return null;
  if (typeof currency !== 'string' || !CURRENCY.test(currency)) return null;
  return { ...base, productHandle, value, currency };
}

/** Which counter on stats/{embeddingId} each event type bumps. */
export const COUNTER: Record<EventType, 'views' | 'clicks' | 'addToCarts'> = {
  view: 'views',
  video_click: 'clicks',
  add_to_cart: 'addToCarts',
};
