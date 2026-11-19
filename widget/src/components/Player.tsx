import { type KeyboardEvent, type TouchEvent, useEffect, useRef, useState } from 'react';
import { formatPrice, prefersReducedMotion } from '../format';
import { root } from '../shopify';
import type { LiveApi, Product, Store, Video } from '../types';
import { Live } from './Live';

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

interface PlayerProps {
  videos: Video[];
  startIndex: number;
  store: Store;
  connectLive: () => Promise<LiveApi>;
  onOpenVideo: (video: Video) => void; // a different video was opened by swiping or keys
  onAdded: (video: Video, product: Product) => void;
  onClose: () => void;
}

const SWIPE_MIN_PX = 60;

export function Player({ videos, startIndex, store, connectLive, onOpenVideo, onAdded, onClose }: PlayerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
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

  function go(delta: number) {
    const next = videos[index + delta];
    if (!next) return;
    setDir(delta > 0 ? 'next' : 'prev');
    setIndex(index + delta);
    onOpenVideo(next);
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
        e.preventDefault(); // Esc: run our exit animation instead of closing instantly
        requestClose();
      }}
      onKeyDown={onKeyDown}
    >
      <button type="button" className="close" aria-label="Close video" onClick={requestClose}>
        ✕
      </button>
      <div className="stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <video key={video.id} className={`clip ${dir}`} src={video.src} poster={video.poster} autoPlay muted loop playsInline controls />
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
      {video.liveId && <Live key={video.liveId} liveId={video.liveId} connect={connectLive} />}
      <div className="products">
        <ProductList key={video.id} video={video} store={store} onAdded={(p) => onAdded(video, p)} />
      </div>
    </dialog>
  );
}
