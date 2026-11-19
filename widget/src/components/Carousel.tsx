import { useEffect, useRef, useState } from 'react';
import { formatPrice, prefersReducedMotion } from '../format';
import { t } from '../i18n';
import type { Product, Store, Video } from '../types';
import { useInView } from './useInView';

interface CardProps {
  video: Video;
  store: Store;
  onOpen: () => void;
  onView: (v: Video) => void;
}

function VideoCard({ video, store, onOpen, onView }: CardProps) {
  const card = useRef<HTMLButtonElement>(null);
  const el = useRef<HTMLVideoElement>(null);
  // Two thresholds: start downloading a bit before the card is visible, play only when mostly visible.
  const nearby = useInView(card, 0, '0px 300px');
  const playing = useInView(card, 0.6);
  const [loaded, setLoaded] = useState(false);
  const [product, setProduct] = useState<Product>();
  const seen = useRef(false);

  // One impression per video per page load, counted when it is actually in view.
  useEffect(() => {
    if (playing && !seen.current) {
      seen.current = true;
      onView(video);
    }
  }, [playing, onView, video]);

  useEffect(() => {
    if (!nearby) return;
    setLoaded(true);
    const handle = video.productHandles[0];
    // Price comes from the store (source of truth). Failing to load it just hides the price.
    if (handle) store.getProduct(handle).then(setProduct).catch(() => {});
  }, [nearby, store, video.productHandles]);

  useEffect(() => {
    const v = el.current;
    if (!v || !loaded || prefersReducedMotion()) return; // reduced motion: the poster stays, nothing autoplays
    if (playing) v.play()?.catch(() => {}); // autoplay can be refused; the poster keeps the card usable
    else v.pause();
  }, [playing, loaded]);

  return (
    <button
      ref={card}
      type="button"
      className="card"
      aria-label={`${t('watch', { title: video.title })}${video.liveId ? t('liveSuffix') : ''}`}
      onClick={onOpen}
    >
      <video ref={el} src={loaded ? video.src : undefined} poster={video.poster} muted loop playsInline preload="metadata" />
      {video.liveId && (
        <span className="live-pill" aria-hidden="true">
          <span className="dot" />
          {t('live')}
        </span>
      )}
      <span className="label">
        <span className="title">{video.title}</span>
        {product && <span className="price">{product.available ? formatPrice(product) : t('soldOut')}</span>}
      </span>
    </button>
  );
}

interface Props {
  videos: Video[];
  store: Store;
  onOpen: (index: number) => void;
  onView: (v: Video) => void;
}

export function Carousel({ videos, store, onOpen, onView }: Props) {
  return (
    <ul className="strip" aria-label={t('shopVideos')}>
      {videos.map((v, i) => (
        <li key={v.id}>
          <VideoCard video={v} store={store} onOpen={() => onOpen(i)} onView={onView} />
        </li>
      ))}
    </ul>
  );
}

/** Same height as the real strip so nothing jumps when config arrives. */
export function CarouselSkeleton() {
  return (
    <div className="strip" aria-busy="true" aria-label={t('loadingVideos')}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" />
      ))}
    </div>
  );
}
