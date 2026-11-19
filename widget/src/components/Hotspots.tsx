import { type RefObject, useEffect, useState } from 'react';
import type { Hotspot, Product, Store } from '../types';

function Chip({ hotspot, store, onOpen }: { hotspot: Hotspot; store: Store; onOpen: (handle: string) => void }) {
  const [product, setProduct] = useState<Product>();
  useEffect(() => {
    let off = false;
    store.getProduct(hotspot.handle).then((p) => !off && setProduct(p)).catch(() => {});
    return () => {
      off = true;
    };
  }, [hotspot.handle, store]);

  if (!product) return null; // can't open a product we couldn't load
  const flip = hotspot.x > 60;
  // Never let the label run under the edge or the side buttons: it may use the room between the dot and the edge.
  const maxWidth = flip ? `max(96px, calc(${hotspot.x}% + 14px))` : `max(96px, calc(${100 - hotspot.x}% - 56px))`;
  return (
    <button
      type="button"
      className={`hotspot${flip ? ' flip' : ''}`}
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%`, maxWidth }}
      aria-label={`Shop ${product.title}`}
      onClick={() => onOpen(hotspot.handle)}
    >
      <span className="hs-dot" aria-hidden="true" />
      <span className="hs-label">{product.title}</span>
    </button>
  );
}

/**
 * Chips that appear over the video during their [start, end) window.
 * It owns the playback time, so the 4 timeupdate events per second re-render only this layer, not the whole player.
 */
export function HotspotLayer({
  hotspots,
  videoRef,
  store,
  onOpen,
}: {
  hotspots: Hotspot[];
  videoRef: RefObject<HTMLVideoElement | null>;
  store: Store;
  onOpen: (handle: string) => void;
}) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || hotspots.length === 0) return;
    const update = () => setTime(v.currentTime);
    v.addEventListener('timeupdate', update);
    update();
    return () => v.removeEventListener('timeupdate', update);
  }, [videoRef, hotspots.length]);

  return (
    <>
      {hotspots
        .filter((h) => time >= h.start && time < h.end)
        .map((h) => (
          <Chip key={`${h.handle}-${h.start}`} hotspot={h} store={store} onOpen={onOpen} />
        ))}
    </>
  );
}
