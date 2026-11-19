import { sanitizeHotspots } from './config';

const base = { handle: 'tee', start: 1, end: 5, x: 40, y: 60 };
const video = (hotspots: unknown) => ({ productHandles: ['tee', 'hat'], hotspots }) as Parameters<typeof sanitizeHotspots>[0];

describe('sanitizeHotspots', () => {
  it('keeps valid hotspots', () => {
    expect(sanitizeHotspots(video([base, { ...base, handle: 'hat', x: 0, y: 100 }]))).toHaveLength(2);
  });

  it('returns [] when hotspots are missing or not an array', () => {
    expect(sanitizeHotspots(video(undefined))).toEqual([]);
    expect(sanitizeHotspots(video('nope'))).toEqual([]);
    expect(sanitizeHotspots({ productHandles: undefined, hotspots: [base] } as never)).toEqual([]);
  });

  it.each([
    ['handle not among the video products', { ...base, handle: 'coat' }],
    ['end before start', { ...base, start: 5, end: 5 }],
    ['negative start', { ...base, start: -1 }],
    ['x out of range', { ...base, x: 101 }],
    ['y out of range', { ...base, y: -5 }],
    ['non-numeric time', { ...base, end: '5' }],
    ['NaN position', { ...base, x: NaN }],
    ['null entry', null],
  ])('drops a hotspot with %s, keeping the valid ones', (_name, bad) => {
    expect(sanitizeHotspots(video([bad, base]))).toEqual([base]);
  });
});
