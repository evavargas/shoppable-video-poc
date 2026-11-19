import type { Product } from './types';

export const formatPrice = (p: Pick<Product, 'price' | 'currency'>) =>
  new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: p.currency }).format(p.price);

/** Users who ask the OS for less motion get no autoplay previews and no animations. */
export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
