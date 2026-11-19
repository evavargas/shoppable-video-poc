import { type KeyboardEvent, type TouchEvent, useCallback, useEffect, useRef, useState } from 'react';
import { formatPrice, prefersReducedMotion } from '../format';
import { root } from '../shopify';
import type { Layout, LiveApi, Product, Store, Video } from '../types';
import { HotspotLayer } from './Hotspots';
import { Live } from './Live';
import { StoryProgress } from './StoryProgress';

type Status = 'idle' | 'adding' | 'added' | 'error';

function ProductCard({ product, store, onAdded }: { product: Product; store: Store; onAdded: (p: Product) => void }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function add() {
    setStatus('adding');
    try {
      await store.addToCart(product);
      setStatus('added');
      onAdded(product); // only after the cart really changed
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add to cart');
      setStatus('error');
    }
  }

  const label = !product.available
    ? 'Sold out'
    : { idle: 'Add to cart', adding: 'Adding…', added: 'Added ✓', error: 'Try again' }[status];

  return (
    <div className="product">
      {product.image && <img className="thumb" src={product.image} alt="" loading="lazy" />}
      <div className="info">
        <strong>{product.title}</strong>
        <div>{formatPrice(product)}</div>
        {status === 'added' && <a href={`${root()}cart`}>View cart</a>}
      </div>
      <button type="button" className="btn" disabled={status === 'adding' || !product.available} onClick={add}>
        {label}
      </button>
      <span role="status" className="sr-only">
        {status === 'added' ? `${product.title} added to cart` : status === 'error' ? error : ''}
      </span>
    </div>
  );
}

/** undefined = still loading; [] = none could be loaded. */
function useProducts(handles: string[], store: Store) {
  const [products, setProducts] = useState<Product[] | undefined>();
  useEffect(() => {
    let cancelled = false;
    // allSettled: one broken handle must not take the others down.
    Promise.allSettled(handles.map((h) => store.getProduct(h))).then((results) => {
      if (cancelled) return;
      setProducts(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
    });
    return () => {
      cancelled = true;
    };
  }, [handles, store]);
  return products;
}

function ProductList({ video, store, onAdded }: { video: Video; store: Store; onAdded: (p: Product) => void }) {
  const products = useProducts(video.productHandles, store);
  if (products === undefined)
    return (
      <p className="note" role="status">
        Loading products…
      </p>
    );
  if (products.length === 0) return <p className="note">Products unavailable right now.</p>;
  return (
    <>
      {products.map((p) => (
        <ProductCard key={p.handle} product={p} store={store} onAdded={onAdded} />
      ))}
    </>
  );
}

/** The product card opened by tapping a hotspot, floating over the video. */
function Sheet({ handle, store, onClose, onAdded }: { handle: string; store: Store; onClose: () => void; onAdded: (p: Product) => void }) {
  const [product, setProduct] = useState<Product>();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let off = false;
    store.getProduct(handle).then((p) => !off && setProduct(p)).catch(() => !off && onClose());
    return () => {
      off = true;
    };
  }, [handle, store, onClose]);

  useEffect(() => ref.current?.focus(), [product]); // move focus into the card for keyboard and screen reader users

  if (!product) return null;
  return (
    <div className="sheet" role="region" aria-label={`${product.title} details`} tabIndex={-1} ref={ref} onTouchStart={(e) => e.stopPropagation()}>
      <button type="button" className="sheet-close" aria-label="Close product" onClick={onClose}>
        ✕
      </button>
      <ProductCard product={product} store={store} onAdded={onAdded} />
    </div>
  );
}

interface PlayerProps {
  layout: Layout;
  videos: Video[];
  startIndex: number;
  store: Store;
  connectLive: () => Promise<LiveApi>;
  onOpenVideo: (video: Video) => void; // a different video was opened by swiping or keys
  onAdded: (video: Video, product: Product) => void;
  onHotspot: (video: Video, handle: string) => void;
  onClose: () => void;
}

const SWIPE_MIN_PX = 60;

export function Player({ layout, videos, startIndex, store, connectLive, onOpenVideo, onAdded, onHotspot, onClose }: PlayerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selected, setSelected] = useState<string | null>(null); // handle of the product opened from a hotspot
  const [index, setIndex] = useState(startIndex);
  const [dir, setDir] = useState<'next' | 'prev' | 'none'>('none');
  const [closing, setClosing] = useState(false);
  const video = videos[index] as Video;

  useEffect(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    // showModal() gives us focus trap, Esc-to-close and a top layer for free.
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);

  const closeSheet = useCallback(() => {
    setSelected(null);
    videoRef.current?.play()?.catch(() => {}); // resume what we paused
  }, []);

  function openHotspot(handle: string) {
    videoRef.current?.pause(); // so the shopper can read the card
    setSelected(handle);
    onHotspot(video, handle);
  }

  function go(delta: number) {
    const next = videos[index + delta];
    if (!next) return;
    setSelected(null);
    setDir(delta > 0 ? 'next' : 'prev');
    setIndex(index + delta);
    onOpenVideo(next);
  }

  // Stories play once and move on by themselves; the last one closes the player.
  function onEnded() {
    if (index < videos.length - 1) go(1);
    else requestClose();
  }

  function requestClose() {
    if (closing) return;
    if (prefersReducedMotion()) return onClose();
    setClosing(true); // plays the exit animation, then unmounts
    setTimeout(onClose, 180);
  }

  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return; // typing in chat
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') go(-1);
  }

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!start || !t) return;
    const dy = t.clientY - start.y;
    const dx = t.clientX - start.x;
    // Mostly vertical and long enough = a swipe. Swipe up = next video, like Reels/TikTok.
    if (Math.abs(dy) > SWIPE_MIN_PX && Math.abs(dy) > Math.abs(dx) * 1.5) go(dy < 0 ? 1 : -1);
  }

  return (
    <dialog
      ref={dialog}
      className={`player${closing ? ' closing' : ''}`}
      aria-label={video.title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault(); // Esc: close the product card first, then the player, with our exit animation
        if (selected) closeSheet();
        else requestClose();
      }}
      onKeyDown={onKeyDown}
    >
      <button type="button" className="close" aria-label="Close video" onClick={requestClose}>
        ✕
      </button>
      <div className={`stage${layout === 'stories' ? ' story-mode' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <video ref={videoRef} key={`video-${video.id}`} className={`clip ${dir}`} src={video.src} poster={video.poster} autoPlay muted playsInline controls loop={layout !== 'stories'} onEnded={layout === 'stories' ? onEnded : undefined} />
        {layout === 'stories' && <StoryProgress key={`progress-${video.id}`} count={videos.length} index={index} videoRef={videoRef} />}
        <HotspotLayer key={`hotspots-${video.id}`} hotspots={video.hotspots ?? []} videoRef={videoRef} store={store} onOpen={openHotspot} />
        {selected && (
          <Sheet
            key={selected}
            handle={selected}
            store={store}
            onClose={closeSheet}
            onAdded={(p) => onAdded(video, p)}
          />
        )}
        {videos.length > 1 && (
          <div className="nav">
            <button type="button" aria-label="Previous video" disabled={index === 0} onClick={() => go(-1)}>
              ▲
            </button>
            <button type="button" aria-label="Next video" disabled={index === videos.length - 1} onClick={() => go(1)}>
              ▼
            </button>
          </div>
        )}
        <p className="counter" aria-live="polite">
          {video.title} · {index + 1}/{videos.length}
        </p>
      </div>
      {/* Sibling keys must be unique: two siblings sharing a key leave stale DOM nodes behind. */}
      {video.liveId && <Live key={`live-${video.liveId}`} liveId={video.liveId} connect={connectLive} />}
      <div className="products">
        <ProductList key={video.id} video={video} store={store} onAdded={(p) => onAdded(video, p)} />
      </div>
    </dialog>
  );
}
