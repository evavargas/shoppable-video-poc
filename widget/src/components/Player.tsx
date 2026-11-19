import { useEffect, useRef, useState } from 'react';
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

  const price = new Intl.NumberFormat(undefined, { style: 'currency', currency: product.currency }).format(product.price);
  const label = !product.available
    ? 'Sold out'
    : { idle: 'Add to cart', adding: 'Adding…', added: 'Added ✓', error: 'Try again' }[status];

  return (
    <div className="product">
      {product.image && <img className="thumb" src={product.image} alt="" loading="lazy" />}
      <div className="info">
        <strong>{product.title}</strong>
        <div>{price}</div>
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

interface PlayerProps {
  video: Video;
  store: Store;
  connectLive: () => Promise<LiveApi>;
  onAdded: (p: Product) => void;
  onClose: () => void;
}

export function Player({ video, store, connectLive, onAdded, onClose }: PlayerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const products = useProducts(video.productHandles, store);

  useEffect(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    // showModal() gives us focus trap, Esc-to-close and a top layer for free.
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);

  return (
    <dialog ref={dialog} className="player" aria-label={video.title} onClose={onClose}>
      <video src={video.src} autoPlay muted loop playsInline controls />
      <button type="button" className="close" aria-label="Close video" onClick={onClose}>
        ✕
      </button>
      {video.liveId && <Live liveId={video.liveId} connect={connectLive} />}
      <div className="products">
        {products === undefined ? (
          <p className="note" role="status">
            Loading products…
          </p>
        ) : products.length === 0 ? (
          <p className="note">Products unavailable right now.</p>
        ) : (
          products.map((p) => <ProductCard key={p.handle} product={p} store={store} onAdded={onAdded} />)
        )}
      </div>
    </dialog>
  );
}
