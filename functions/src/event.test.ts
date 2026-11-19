import { describe, expect, it } from 'vitest';
import { COUNTER, parseEvent } from './event';

const base = { type: 'view', embeddingId: 'home-carousel', videoId: 'v1', sessionId: 'abc123' };
const atc = { ...base, type: 'add_to_cart', productHandle: 'tee', value: 29, currency: 'USD' };

describe('parseEvent', () => {
  it('accepts view and video_click, dropping unknown and add_to_cart-only fields', () => {
    expect(parseEvent({ ...base, evil: '<script>', value: 999 })).toEqual(base);
    expect(parseEvent({ ...base, type: 'video_click' })).toEqual({ ...base, type: 'video_click' });
  });

  it('accepts a complete add_to_cart event', () => {
    expect(parseEvent(atc)).toEqual(atc);
  });

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['unknown type', { ...base, type: 'purchase' }],
    ['bad id characters', { ...base, videoId: 'a/b' }],
    ['missing session', { ...base, sessionId: undefined }],
    ['add_to_cart without value', { ...atc, value: undefined }],
    ['negative value', { ...atc, value: -5 }],
    ['absurd value', { ...atc, value: 1e9 }],
    ['NaN value', { ...atc, value: NaN }],
    ['bad currency', { ...atc, currency: 'usd' }],
    ['bad handle', { ...atc, productHandle: 'x y' }],
  ])('rejects %s', (_name, body) => {
    expect(parseEvent(body)).toBeNull();
  });
});

describe('COUNTER', () => {
  it('maps every event type to a stats counter', () => {
    expect(COUNTER).toEqual({ view: 'views', video_click: 'clicks', add_to_cart: 'addToCarts' });
  });
});
