import { fetchConfig } from './api';

const ok = { embeddingId: 'x', theme: { accent: '#000' }, videos: [] };

function stubFetch(res: Partial<Response> | Error) {
  vi.stubGlobal('fetch', vi.fn(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res))));
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchConfig', () => {
  it('requests the config for the embedding id and returns it', async () => {
    stubFetch({ ok: true, json: async () => ok });
    await expect(fetchConfig('https://api.test', 'home carousel')).resolves.toEqual(ok);
    expect(fetch).toHaveBeenCalledWith('https://api.test/api/getEmbedConfig?id=home%20carousel', expect.anything());
  });

  it('resolves relative media paths against our origin, leaving absolute URLs alone', async () => {
    const cfg = { ...ok, videos: [{ id: 'v', src: '/media/a.mp4', poster: '/media/a.jpg', title: 't', productHandles: [] }, { id: 'w', src: 'https://cdn.test/b.mp4', title: 't', productHandles: [] }] };
    stubFetch({ ok: true, json: async () => cfg });
    const out = await fetchConfig('https://api.test', 'home');
    expect(out.videos[0]).toMatchObject({ src: 'https://api.test/media/a.mp4', poster: 'https://api.test/media/a.jpg' });
    expect(out.videos[1]).toMatchObject({ src: 'https://cdn.test/b.mp4', poster: undefined });
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
