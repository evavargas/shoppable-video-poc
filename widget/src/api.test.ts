import { fetchConfig, fetchLiveStatus } from './api';

const ok = { embeddingId: 'x', theme: { accent: '#000' }, videos: [] };

function stubFetch(res: Partial<Response> | Error) {
  vi.stubGlobal('fetch', vi.fn(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res))));
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchConfig', () => {
  it('requests the config for the embedding id and returns it', async () => {
    stubFetch({ ok: true, json: async () => ok });
    await expect(fetchConfig('https://api.test', 'home carousel')).resolves.toEqual({ ...ok, layout: 'carousel' });
    expect(fetch).toHaveBeenCalledWith('https://api.test/api/getEmbedConfig?id=home%20carousel', expect.anything());
  });

  it('resolves relative media paths against our origin, leaving absolute URLs alone', async () => {
    const cfg = { ...ok, videos: [{ id: 'v', src: '/media/a.mp4', poster: '/media/a.jpg', title: 't', productHandles: [] }, { id: 'w', src: 'https://cdn.test/b.mp4', title: 't', productHandles: [] }] };
    stubFetch({ ok: true, json: async () => cfg });
    const out = await fetchConfig('https://api.test', 'home');
    expect(out.videos[0]).toMatchObject({ src: 'https://api.test/media/a.mp4', poster: 'https://api.test/media/a.jpg' });
    expect(out.videos[1]).toMatchObject({ src: 'https://cdn.test/b.mp4', poster: undefined });
  });

  it('keeps layout "stories" and falls back to "carousel" for anything else', async () => {
    stubFetch({ ok: true, json: async () => ({ ...ok, layout: 'stories' }) });
    expect((await fetchConfig('https://api.test', 'a')).layout).toBe('stories');
    stubFetch({ ok: true, json: async () => ({ ...ok, layout: 'grid' }) });
    expect((await fetchConfig('https://api.test', 'a')).layout).toBe('carousel');
    stubFetch({ ok: true, json: async () => ok });
    expect((await fetchConfig('https://api.test', 'a')).layout).toBe('carousel');
    stubFetch({ ok: true, json: async () => ({ ...ok, layout: 'floating' }) });
    expect((await fetchConfig('https://api.test', 'a')).layout).toBe('floating');
  });

  it.each([
    ['http error', { ok: false, status: 404 }],
    ['bad shape', { ok: true, json: async () => ({ videos: 'nope' }) }],
    ['network error', new Error('offline')],
  ])('rejects on %s', async (_name, res) => {
    stubFetch(res as Partial<Response> | Error);
    await expect(fetchConfig('https://api.test', 'x')).rejects.toThrow();
  });
});

describe('fetchLiveStatus', () => {
  it('returns the status from the endpoint', async () => {
    stubFetch({ ok: true, json: async () => ({ status: 'live' }) });
    await expect(fetchLiveStatus('https://api.test', 'bakery live')).resolves.toBe('live');
    expect(fetch).toHaveBeenCalledWith('https://api.test/api/liveStatus?id=bakery%20live', expect.anything());
  });

  it('treats http errors and odd bodies as ended, and rejects on network errors', async () => {
    stubFetch({ ok: false, status: 500 });
    await expect(fetchLiveStatus('https://api.test', 'x')).resolves.toBe('ended');
    stubFetch({ ok: true, json: async () => ({ status: 7 }) });
    await expect(fetchLiveStatus('https://api.test', 'x')).resolves.toBe('ended');
    stubFetch(new Error('offline'));
    await expect(fetchLiveStatus('https://api.test', 'x')).rejects.toThrow();
  });
});
