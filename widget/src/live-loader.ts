import type { FirebaseSettings, LiveApi } from './types';

type PocLive = { connect(settings: FirebaseSettings): LiveApi };

function loadScript(origin: string): Promise<PocLive> {
  const w = window as unknown as { PocLive?: PocLive };
  if (w.PocLive) return Promise.resolve(w.PocLive);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${origin}/live.js`;
    s.async = true;
    s.onload = () => (w.PocLive ? resolve(w.PocLive) : reject(new Error('live.js did not register PocLive')));
    s.onerror = () => reject(new Error('live.js failed to load'));
    document.head.append(s);
  });
}

/** Loads live.js and connects to Firestore the first time it is needed; later calls reuse the connection. */
export function makeLiveConnector(origin: string): (settings: FirebaseSettings) => Promise<LiveApi> {
  let pending: Promise<LiveApi> | undefined;
  return (settings) => {
    pending ??= loadScript(origin).then((m) => m.connect(settings));
    pending.catch(() => (pending = undefined)); // allow a retry after a failure
    return pending;
  };
}
