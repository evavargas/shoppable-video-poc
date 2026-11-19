import { fetchConfig, fetchLiveStatus, mockStore } from './api';
import { makeLiveConnector } from './live-loader';
import { mount } from './mount';
import { shopifyStore } from './shopify';
import { makeTracker } from './track';

// Must be read synchronously while the script runs; it is null afterwards.
// The API lives next to widget.js (Firebase Hosting rewrites /api/* to Cloud Functions).
const scriptOrigin = (document.currentScript as HTMLScriptElement | null)?.src
  ? new URL((document.currentScript as HTMLScriptElement).src).origin
  : location.origin;

const connectLive = makeLiveConnector(scriptOrigin);

function init() {
  document.querySelectorAll<HTMLElement>('[data-source="poc"][data-embedding-id]').forEach((host) => {
    if (host.shadowRoot) return; // already mounted (script included twice)
    const apiBase = host.dataset.apiBase ?? scriptOrigin; // data-api-base overrides, handy for local dev
    try {
      // data-store="mock" = not a Shopify page (local demo): fake products instead of /products/{handle}.js
      const store = host.dataset.store === 'mock' ? mockStore : shopifyStore;
      mount(host, {
        loadConfig: (id) => fetchConfig(apiBase, id),
        fetchLiveStatus: (liveId) => fetchLiveStatus(apiBase, liveId),
        store,
        track: makeTracker(apiBase, host.dataset.embeddingId ?? ''),
        connectLive,
      });
    } catch {
      host.style.display = 'none'; // never break the store page
    }
  });
}

// An async script can run before or after the DOM is parsed; handle both.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
