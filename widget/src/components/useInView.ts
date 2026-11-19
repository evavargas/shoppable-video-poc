import { type RefObject, useEffect, useState } from 'react';

/** True while at least `threshold` of the element is visible (rootMargin lets you "see" it early). */
export function useInView(ref: RefObject<Element | null>, threshold = 0, rootMargin = '0px') {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry && setInView(entry.isIntersecting && entry.intersectionRatio >= threshold),
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, rootMargin]);

  return inView;
}
