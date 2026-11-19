import type { Product, Store } from './types';

/**
 * Tells the host page that the cart changed. A widget can't know how a theme draws its cart,
 * so it dispatches a DOM event; the page (or theme) decides what to refresh.
 *
 * On a real Shopify theme the page's listener would call the Section Rendering API,
 * e.g. fetch(`${root}?sections=cart-icon-bubble`) and swap the returned HTML into the header,
 * which re-renders the count with the theme's own markup.
 */
export async function emitCartAdd(product: Product, store: Store) {
  const count = await store.getCartCount?.().catch(() => undefined);
  window.dispatchEvent(
    new CustomEvent('poc:cart-add', {
      detail: { handle: product.handle, title: product.title, price: product.price, currency: product.currency, count },
    }),
  );
}
