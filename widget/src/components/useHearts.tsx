import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../format';

export const MAX_HEARTS_ON_SCREEN = 30;
export const MAX_HEARTS_PER_BURST = 8;

/**
 * Floating hearts. State is a short list; each heart removes itself when its CSS animation ends.
 * Capped, because a busy live can deliver hundreds per second and the DOM must not grow with it.
 * With reduced motion nothing floats (the live panel shows a running counter instead).
 */
export function useHearts() {
  const [items, setItems] = useState<{ id: number; x: number }[]>([]);
  const next = useRef(0);

  const burst = useCallback((n: number) => {
    if (prefersReducedMotion()) return;
    const count = Math.min(Math.max(0, Math.floor(n)), MAX_HEARTS_PER_BURST);
    if (count === 0) return;
    setItems((prev) => [...prev, ...Array.from({ length: count }, () => ({ id: next.current++, x: 12 + Math.random() * 76 }))].slice(-MAX_HEARTS_ON_SCREEN));
  }, []);

  const remove = useCallback((id: number) => setItems((prev) => prev.filter((h) => h.id !== id)), []);
  return { items, burst, remove };
}

const HEART_LIFETIME_MS = 2000; // a little longer than the 1.6 s animation

function Heart({ id, x, remove }: { id: number; x: number; remove: (id: number) => void }) {
  // Normally the animation end removes it. The timer is the safety net for when animations don't run
  // (a background tab, a hidden player), so hearts can never pile up.
  useEffect(() => {
    const t = setTimeout(() => remove(id), HEART_LIFETIME_MS);
    return () => clearTimeout(t);
  }, [id, remove]);
  return (
    <span className="heart" style={{ left: `${x}%` }} onAnimationEnd={() => remove(id)}>
      ❤
    </span>
  );
}

export function HeartLayer({ items, remove }: { items: { id: number; x: number }[]; remove: (id: number) => void }) {
  return (
    <div className="hearts" aria-hidden="true">
      {items.map((h) => (
        <Heart key={h.id} id={h.id} x={h.x} remove={remove} />
      ))}
    </div>
  );
}
