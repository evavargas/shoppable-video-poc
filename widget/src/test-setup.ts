import '@testing-library/jest-dom/vitest';
import { act } from '@testing-library/react';

// jsdom has no IntersectionObserver or media playback: fake them so tests can drive visibility.
const observers = new Set<MockIO>();

class MockIO {
  els = new Set<Element>();
  constructor(public cb: IntersectionObserverCallback) {
    observers.add(this);
  }
  observe(e: Element) {
    this.els.add(e);
  }
  unobserve(e: Element) {
    this.els.delete(e);
  }
  disconnect() {
    observers.delete(this);
  }
  takeRecords() {
    return [];
  }
}

vi.stubGlobal('IntersectionObserver', MockIO);
HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
HTMLMediaElement.prototype.pause = vi.fn();

/** Pretend `ratio` of `el` is now visible. */
export function intersect(el: Element, ratio: number) {
  act(() => {
    for (const o of observers) {
      if (!o.els.has(el)) continue;
      const entry = { target: el, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry;
      o.cb([entry], o as unknown as IntersectionObserver);
    }
  });
}
