import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { emitCartAdd } from './cart-event';
import { Carousel, CarouselSkeleton } from './components/Carousel';
import { MiniPlayer } from './components/MiniPlayer';
import { Stories, StoriesSkeleton } from './components/Stories';
import { Player } from './components/Player';
import type { Track } from './track';
import type { EmbedConfig, FirebaseSettings, Layout, LiveApi, Product, Store } from './types';

interface Props {
  embeddingId: string;
  onFail: () => void;
  loadConfig: (embeddingId: string) => Promise<EmbedConfig>;
  store: Store;
  track: Track;
  connectLive: (settings: FirebaseSettings) => Promise<LiveApi>;
  fetchLiveStatus: (liveId: string) => Promise<string>;
  layoutHint?: Layout; // from data-layout on the host div: lets the loading skeleton match the final height
  onLayout?: (layout: Layout) => void; // lets the host element adopt the layout's size
}

/** The carousel cards and the player ask for the same products: fetch each handle once. */
function memoizeStore(store: Store): Store {
  const cache = new Map<string, Promise<Product>>();
  return {
    ...store,
    getProduct(handle) {
      let p = cache.get(handle);
      if (!p) {
        p = store.getProduct(handle);
        p.catch(() => cache.delete(handle)); // don't cache failures
        cache.set(handle, p);
      }
      return p;
    },
  };
}

/** Which stories were opened, kept for the browser session so the ring turns grey like on Instagram. */
function useSeen(embeddingId: string) {
  const key = `poc-seen:${embeddingId}`;
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => {
    try {
      return new Set<string>(JSON.parse(sessionStorage.getItem(key) ?? '[]'));
    } catch {
      return new Set(); // storage blocked or corrupted: start fresh
    }
  });
  const markSeen = useCallback(
    (id: string) =>
      setSeen((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        try {
          sessionStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          /* not worth failing for */
        }
        return next;
      }),
    [key],
  );
  return { seen, markSeen };
}

export function App({ embeddingId, onFail, loadConfig, store, track, connectLive, fetchLiveStatus, layoutHint = 'carousel', onLayout }: Props) {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const cachedStore = useMemo(() => memoizeStore(store), [store]);
  const { seen, markSeen } = useSeen(embeddingId);

  useEffect(() => {
    let cancelled = false;
    loadConfig(embeddingId)
      .then((c) => {
        if (cancelled) return;
        if (c.videos.length === 0) onFail();
        else setConfig(c);
      })
      .catch(() => !cancelled && onFail());
    return () => {
      cancelled = true;
    };
  }, [embeddingId, loadConfig, onFail]);

  const layoutFromConfig = config?.layout;
  useEffect(() => {
    if (layoutFromConfig) onLayout?.(layoutFromConfig);
  }, [layoutFromConfig, onLayout]);

  // Stable identity: Live re-subscribes its listeners whenever this function changes.
  const firebase = config?.firebase;
  const connect = useCallback(
    () => (firebase ? connectLive(firebase) : Promise.reject(new Error('no firebase settings'))),
    [firebase, connectLive],
  );

  if (!config) {
    if (layoutHint === 'floating') return null; // nothing to reserve: it floats
    return <div className="root">{layoutHint === 'stories' ? <StoriesSkeleton /> : <CarouselSkeleton />}</div>;
  }

  const layout = config.layout ?? 'carousel';
  // Opening from a story avatar is a story_open; opening from the carousel is a video_click.
  const trackOpen = (videoId: string) => track({ type: layout === 'stories' ? 'story_open' : 'video_click', videoId });

  return (
    <div className="root" style={{ '--accent': config.theme.accent } as CSSProperties}>
      {layout === 'floating' ? (
        <MiniPlayer
          embeddingId={embeddingId}
          videos={config.videos}
          fetchLiveStatus={fetchLiveStatus}
          connectLive={connect}
          hidden={open !== null}
          onView={(v) => track({ type: 'view', videoId: v.id })}
          onOpen={(i) => {
            trackOpen(config.videos[i]?.id ?? '');
            setOpen(i);
          }}
        />
      ) : layout === 'stories' ? (
        <Stories
          videos={config.videos}
          seen={seen}
          onView={(v) => track({ type: 'view', videoId: v.id })}
          onOpen={(i) => {
            const v = config.videos[i];
            if (v) {
              trackOpen(v.id);
              markSeen(v.id);
            }
            setOpen(i);
          }}
        />
      ) : (
        <Carousel
          videos={config.videos}
          store={cachedStore}
          onView={(v) => track({ type: 'view', videoId: v.id })}
          onOpen={(i) => {
            trackOpen(config.videos[i]?.id ?? '');
            setOpen(i);
          }}
        />
      )}
      {open !== null && (
        <Player
          layout={layout}
          videos={config.videos}
          startIndex={open}
          store={cachedStore}
          connectLive={connect}
          onOpenVideo={(v) => {
            trackOpen(v.id);
            markSeen(v.id);
          }}
          onHotspot={(v, handle) => track({ type: 'hotspot_click', videoId: v.id, productHandle: handle })}
          onReaction={(v, count) => track({ type: 'reaction', videoId: v.id, count })}
          onAdded={(v, p) => {
            track({ type: 'add_to_cart', videoId: v.id, productHandle: p.handle, value: p.price, currency: p.currency });
            void emitCartAdd(p, cachedStore);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
