import { sanitizeHotspots } from './config';
import { shopifyStore } from './shopify';
import type { EmbedConfig, Store } from './types';

/** Fetches the embed config from our Cloud Function. Any failure rejects; the caller hides the widget. */
export async function fetchConfig(apiBase: string, embeddingId: string): Promise<EmbedConfig> {
  const res = await fetch(`${apiBase}/api/getEmbedConfig?id=${encodeURIComponent(embeddingId)}`, {
    signal: AbortSignal.timeout(4000), // a hanging API must not leave a skeleton on the store page forever
  });
  if (!res.ok) throw new Error(`config request failed: ${res.status}`);
  const data = (await res.json()) as EmbedConfig;
  // Trust boundary: the shape comes from the network, so check what we rely on.
  if (!Array.isArray(data.videos) || typeof data.theme?.accent !== 'string') throw new Error('bad config shape');
  // Media paths in the config are relative to OUR origin ("/media/x.mp4"), not to the store the widget runs on.
  const abs = (u?: string) => (u?.startsWith('/') ? apiBase + u : u);
  return {
    ...data,
    layout: data.layout === 'stories' || data.layout === 'floating' ? data.layout : 'carousel', // unknown values fall back to the default
    videos: data.videos.map((v) => ({ ...v, src: abs(v.src) ?? v.src, poster: abs(v.poster), hotspots: sanitizeHotspots(v) })),
  };
}

/**
 * For pages that are not a Shopify store (the demo). Products still come from Shopify-shaped JSON files
 * (/products/{handle}.js), so the real parsing code runs; only the cart write is faked, because a static host can't POST.
 */
export const mockStore: Store = {
  getProduct: shopifyStore.getProduct,
  addToCart: () => new Promise((resolve) => setTimeout(resolve, 400)),
};

/** Cheap "is a live on right now?" check. Any failure counts as "not live": the mini-player just doesn't appear. */
export async function fetchLiveStatus(apiBase: string, liveId: string): Promise<string> {
  const res = await fetch(`${apiBase}/api/liveStatus?id=${encodeURIComponent(liveId)}`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return 'ended';
  const data = (await res.json()) as { status?: unknown };
  return typeof data.status === 'string' ? data.status : 'ended';
}
