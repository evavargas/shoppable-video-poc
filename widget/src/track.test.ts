import { makeTracker } from './track';

afterEach(() => vi.unstubAllGlobals());

describe('makeTracker', () => {
  it('sends events with sendBeacon as text/plain, adding embedding and session ids', () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    const track = makeTracker('https://api.test', 'home');

    track({ type: 'view', videoId: 'v1' });

    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe('https://api.test/api/track');
    expect(blob.type).toBe('text/plain');
    expect(blob.size).toBeGreaterThan(20);
  });

  it('falls back to fetch keepalive when sendBeacon is missing or refuses', () => {
    const fetchFn = vi.fn(() => Promise.resolve({}));
    vi.stubGlobal('fetch', fetchFn);
    vi.stubGlobal('navigator', { sendBeacon: () => false });
    const track = makeTracker('https://api.test', 'home');

    track({ type: 'add_to_cart', videoId: 'v1', productHandle: 'tee', value: 29, currency: 'USD' });

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toMatchObject({ type: 'add_to_cart', embeddingId: 'home', value: 29 });
  });

  it('never throws, even when everything fails', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: () => {
        throw new Error('boom');
      },
    });
    expect(() => makeTracker('https://api.test', 'home')({ type: 'view', videoId: 'v1' })).not.toThrow();
  });
});
