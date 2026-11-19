import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Carousel, CarouselSkeleton } from './components/Carousel';
import { Player } from './components/Player';
import type { Track } from './track';
import type { EmbedConfig, FirebaseSettings, LiveApi, Store, Video } from './types';

interface Props {
  embeddingId: string;
  onFail: () => void;
  loadConfig: (embeddingId: string) => Promise<EmbedConfig>;
  store: Store;
  track: Track;
  connectLive: (settings: FirebaseSettings) => Promise<LiveApi>;
}

export function App({ embeddingId, onFail, loadConfig, store, track, connectLive }: Props) {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [open, setOpen] = useState<Video | null>(null);

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
        onView={(v) => track({ type: 'view', videoId: v.id })}
        onOpen={(v) => {
          track({ type: 'video_click', videoId: v.id });
          setOpen(v);
        }}
      />
      {open && (
        <Player
          video={open}
          store={store}
          connectLive={connect}
          onAdded={(p) =>
            track({ type: 'add_to_cart', videoId: open.id, productHandle: p.handle, value: p.price, currency: p.currency })
          }
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
