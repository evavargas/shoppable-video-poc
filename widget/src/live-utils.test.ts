import { VIEWER_QUERY_LIMIT, VIEWER_WINDOW_MS, countActive, formatWatching } from './live-utils';

describe('countActive', () => {
  const now = 1_000_000;

  it('counts heartbeats inside the window, edge included', () => {
    expect(countActive([now, now - 1000, now - VIEWER_WINDOW_MS], now)).toBe(3);
  });

  it('ignores stale heartbeats and unknown (0) timestamps', () => {
    expect(countActive([now - VIEWER_WINDOW_MS - 1, 0], now)).toBe(0);
  });

  it('is zero for an empty list and respects a custom window', () => {
    expect(countActive([], now)).toBe(0);
    expect(countActive([now - 5000], now, 4000)).toBe(0);
  });
});

describe('formatWatching', () => {
  it('shows the exact count normally, and "N+" when the listener hit its cap', () => {
    expect(formatWatching(7, 7)).toBe('7');
    expect(formatWatching(60, VIEWER_QUERY_LIMIT)).toBe(`${VIEWER_QUERY_LIMIT}+`);
  });
});
