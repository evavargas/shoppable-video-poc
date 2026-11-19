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
  return data;
}

/** For pages that are not a Shopify store (local demo): invents a product from its handle. */
export const mockStore: Store = {
  getProduct: async (handle) => ({
    handle,
    title: handle.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    price: 49,
    currency: 'USD',
    variantId: 1,
    available: true,
  }),
  addToCart: () => new Promise((resolve) => setTimeout(resolve, 400)),
};
