import type { Product, Store } from './types';

interface ShopifyGlobal {
  routes?: { root?: string };
  currency?: { active?: string };
}

interface ProductJson {
  handle: string;
  title: string;
  featured_image: string | null;
  options?: (string | { name: string; values?: string[] })[];
  variants: { id: number; title?: string; available: boolean; price: number; option1?: string | null; option2?: string | null; option3?: string | null }[]; // price in cents (a number in .js; a string in some themes' JSON)
}

const shopify = () => (window as unknown as { Shopify?: ShopifyGlobal }).Shopify;
// Stores with several languages/markets live under /en/, /fr/…: always build URLs from Shopify's own root.
export const root = () => shopify()?.routes?.root ?? '/';

/**
 * The widget runs ON the store's domain, so these are same-origin requests:
 * no API key, no CORS, and the cart cookie is the shopper's own.
 */
export const shopifyStore: Store = {
  async getProduct(handle): Promise<Product> {
    const res = await fetch(`${root()}products/${encodeURIComponent(handle)}.js`);
    if (!res.ok) throw new Error(`product ${handle}: ${res.status}`);
    const p = (await res.json()) as ProductJson;
    // PoC: no variant picker, so use the first variant that can be bought.
    const v = p.variants.find((x) => x.available) ?? p.variants[0];
    if (!v) throw new Error(`product ${handle} has no variants`);
    const variants = p.variants.map((x) => ({
      id: x.id,
      title: x.title ?? '',
      available: x.available,
      price: Number(x.price) / 100,
      options: [x.option1, x.option2, x.option3].filter((o): o is string => typeof o === 'string'),
    }));
    // Shopify's /products/{handle}.js lists options as names (older shape) or objects with values (newer shape).
    const options =
      variants.length > 1
        ? (p.options ?? []).map((o, i) => {
            const name = typeof o === 'string' ? o : o.name;
            const values = (typeof o === 'string' ? undefined : o.values) ?? [...new Set(variants.map((x) => x.options[i]).filter((x): x is string => Boolean(x)))];
            return { name, values };
          })
        : undefined;
    return {
      handle: p.handle,
      title: p.title,
      price: Number(v.price) / 100,
      currency: shopify()?.currency?.active ?? 'USD',
      variantId: v.id,
      image: p.featured_image ?? undefined,
      available: v.available,
      ...(options?.length ? { options, variants } : {}),
    };
  },

  async addToCart(product) {
    const res = await fetch(`${root()}cart/add.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: product.variantId, quantity: 1 }] }),
    });
    if (!res.ok) {
      // Shopify answers 422 with a human-readable "description", e.g. when sold out.
      const body = (await res.json().catch(() => null)) as { description?: string } | null;
      throw new Error(body?.description ?? `cart/add failed: ${res.status}`);
    }
  },

  async getCartCount() {
    const res = await fetch(`${root()}cart.js`);
    return res.ok ? ((await res.json()) as { item_count?: number }).item_count : undefined;
  },
};
