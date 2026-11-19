import type { Hotspot, Video } from './types';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Hotspots come from the network, so check them before they reach the UI.
 * Invalid ones are dropped one by one: a typo in one hotspot must not remove the others (or the video).
 */
export function sanitizeHotspots(video: Pick<Video, 'productHandles' | 'hotspots'>): Hotspot[] {
  if (!Array.isArray(video.hotspots) || !Array.isArray(video.productHandles)) return [];
  return video.hotspots.filter(
    (h) =>
      typeof h === 'object' &&
      h !== null &&
      typeof h.handle === 'string' &&
      video.productHandles.includes(h.handle) &&
      finite(h.start) &&
      finite(h.end) &&
      finite(h.x) &&
      finite(h.y) &&
      h.start >= 0 &&
      h.end > h.start &&
      h.x >= 0 &&
      h.x <= 100 &&
      h.y >= 0 &&
      h.y <= 100,
  );
}
