import { shopifyStore } from './shopify';
import type { Product } from './types';

const productJson = {
  handle: 'tee',
  title: 'Cotton Tee',
  featured_image: 'https://cdn.test/tee.jpg',
  variants: [
    { id: 1, available: false, price: 2900 },
    { id: 2, available: true, price: 3100 },
  ],
};

function stubFetch(res: Partial<Response>) {
  const fn = vi.fn(() => Promise.resolve(res));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { Shopify?: unknown }).Shopify;
});

describe('shopifyStore.getProduct', () => {
  it('maps /products/{handle}.js: cents to units, first available variant', async () => {
    const fetchFn = stubFetch({ ok: true, json: async () => productJson });
    const p = await shopifyStore.getProduct('tee');
    expect(fetchFn).toHaveBeenCalledWith('/products/tee.js');
    expect(p).toMatchObject({ title: 'Cotton Tee', price: 31, variantId: 2, available: true, currency: 'USD' });
  });

  it('respects the market prefix and currency from window.Shopify', async () => {
    (window as { Shopify?: unknown }).Shopify = { routes: { root: '/fr/' }, currency: { active: 'EUR' } };
    const fetchFn = stubFetch({ ok: true, json: async () => productJson });
    const p = await shopifyStore.getProduct('tee');
    expect(fetchFn).toHaveBeenCalledWith('/fr/products/tee.js');
    expect(p.currency).toBe('EUR');
  });

  it('rejects when the product does not exist', async () => {
    stubFetch({ ok: false, status: 404 });
    await expect(shopifyStore.getProduct('nope')).rejects.toThrow('404');
  });
});

describe('shopifyStore.addToCart', () => {
  const product = { variantId: 2 } as Product;

  it('POSTs the variant id to /cart/add.js', async () => {
    const fetchFn = stubFetch({ ok: true });
    await shopifyStore.addToCart(product);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/cart/add.js');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ items: [{ id: 2, quantity: 1 }] });
  });

  it("surfaces Shopify's own error message (422 sold out)", async () => {
    stubFetch({ ok: false, status: 422, json: async () => ({ description: 'All 3 are in your cart.' }) });
    await expect(shopifyStore.addToCart(product)).rejects.toThrow('All 3 are in your cart.');
  });
});
