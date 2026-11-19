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

  it.each([
    ['http error', { ok: false, status: 404 }],
    ['bad shape', { ok: true, json: async () => ({ videos: 'nope' }) }],
    ['network error', new Error('offline')],
  ])('rejects on %s', async (_name, res) => {
    stubFetch(res as Partial<Response> | Error);
    await expect(fetchConfig('https://api.test', 'x')).rejects.toThrow();
  });
});
