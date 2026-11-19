import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { emitCartAdd } from './cart-event';
import { Carousel, CarouselSkeleton } from './components/Carousel';
import { Player } from './components/Player';
import type { Track } from './track';
import type { EmbedConfig, FirebaseSettings, LiveApi, Product, Store } from './types';

interface Props {
  embeddingId: string;
  onFail: () => void;
  loadConfig: (embeddingId: string) => Promise<EmbedConfig>;
  store: Store;
  track: Track;
  connectLive: (settings: FirebaseSettings) => Promise<LiveApi>;
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

export function App({ embeddingId, onFail, loadConfig, store, track, connectLive }: Props) {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const cachedStore = useMemo(() => memoizeStore(store), [store]);

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

  // Stable identity: Live re-subscribes its listeners whenever this function changes.
  const firebase = config?.firebase;
  const connect = useCallback(
    () => (firebase ? connectLive(firebase) : Promise.reject(new Error('no firebase settings'))),
    [firebase, connectLive],
  );

  if (!config) return <CarouselSkeleton />;

  return (
    <div style={{ '--accent': config.theme.accent } as CSSProperties}>
      <Carousel
        videos={config.videos}
        store={cachedStore}
        onView={(v) => track({ type: 'view', videoId: v.id })}
        onOpen={(i) => {
          track({ type: 'video_click', videoId: config.videos[i]?.id ?? '' });
          setOpen(i);
        }}
      />
      {open !== null && (
        <Player
          videos={config.videos}
          startIndex={open}
          store={cachedStore}
          connectLive={connect}
          onOpenVideo={(v) => track({ type: 'video_click', videoId: v.id })}
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
