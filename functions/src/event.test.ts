import { describe, expect, it } from 'vitest';
import { COUNTER, parseEvent } from './event';

const base = { type: 'view', embeddingId: 'home-carousel', videoId: 'v1', sessionId: 'abc123' };
const atc = { ...base, type: 'add_to_cart', productHandle: 'tee', value: 29, currency: 'USD' };

describe('parseEvent', () => {
  it('accepts view and video_click, dropping unknown and add_to_cart-only fields', () => {
    expect(parseEvent({ ...base, evil: '<script>', value: 999 })).toEqual(base);
    expect(parseEvent({ ...base, type: 'video_click' })).toEqual({ ...base, type: 'video_click' });
    expect(parseEvent({ ...base, type: 'story_open', productHandle: 'x' })).toEqual({ ...base, type: 'story_open' });
  });

  it('accepts hotspot_click with a product handle, and drops price fields', () => {
    const hs = { ...base, type: 'hotspot_click', productHandle: 'tee' };
    expect(parseEvent({ ...hs, value: 5, currency: 'USD' })).toEqual(hs);
  });

  it('rejects hotspot_click without a valid product handle', () => {
    expect(parseEvent({ ...base, type: 'hotspot_click' })).toBeNull();
    expect(parseEvent({ ...base, type: 'hotspot_click', productHandle: 'a b' })).toBeNull();
  });

  it('accepts a reaction batch with an integer count from 1 to 50', () => {
    const r = { ...base, type: 'reaction', count: 12 };
    expect(parseEvent({ ...r, productHandle: 'x', value: 3 })).toEqual(r);
    expect(parseEvent({ ...r, count: 1 })).toEqual({ ...r, count: 1 });
    expect(parseEvent({ ...r, count: 50 })).toEqual({ ...r, count: 50 });
  });

  it.each([0, -3, 51, 2.5, NaN, '5', undefined, Infinity])('rejects a reaction with count %p', (count) => {
    expect(parseEvent({ ...base, type: 'reaction', count })).toBeNull();
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
    expect(COUNTER).toEqual({
      view: 'views',
      video_click: 'clicks',
      story_open: 'storyOpens',
      hotspot_click: 'hotspotClicks',
      reaction: 'reactions',
      add_to_cart: 'addToCarts',
    });
  });
});
