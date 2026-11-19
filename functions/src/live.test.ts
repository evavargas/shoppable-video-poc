import { describe, expect, it } from 'vitest';
import { normalizeStatus } from './live';

describe('normalizeStatus', () => {
  it.each(['live', 'scheduled', 'ended'])('keeps %s', (s) => {
    expect(normalizeStatus(s)).toBe(s);
  });

  it.each([undefined, null, '', 'LIVE', 'on air', 1, {}])('treats %p as ended', (v) => {
    expect(normalizeStatus(v)).toBe('ended');
  });
});
