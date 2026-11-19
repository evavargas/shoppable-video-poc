/**
 * Tiny translation layer: two languages, no library. The language comes from the page (`<html lang>` or `data-lang` on the host div),
 * so one build of widget.js speaks the store's language. Missing keys fall back to English, never to an empty string.
 */
const en = {
  addToCart: 'Add to cart',
  adding: 'Adding…',
  added: 'Added ✓',
  tryAgain: 'Try again',
  addFailed: 'Could not add to cart',
  soldOut: 'Sold out',
  viewCart: 'View cart',
  loadingProducts: 'Loading products…',
  productsUnavailable: 'Products unavailable right now.',
  chooseOption: 'Choose {name}',
  closeVideo: 'Close video',
  prevVideo: 'Previous video',
  nextVideo: 'Next video',
  watch: 'Watch: {title}',
  live: 'LIVE',
  liveSuffix: ', live',
  seenSuffix: ', seen',
  openStory: 'Open story: {title}',
  shopVideos: 'Shop the videos',
  stories: 'Stories',
  loadingVideos: 'Loading videos',
  loadingStories: 'Loading stories',
  shop: 'Shop {title}',
  productDetails: '{title} details',
  closeProduct: 'Close product',
  liveRegion: 'Live',
  liveChat: 'Live chat',
  message: 'Message',
  saySomething: 'Say something…',
  send: 'Send',
  sendHeart: 'Send a heart',
  watching: '{n} watching',
  guest: 'Guest',
  pinnedByHost: 'Pinned by the host',
  hostPinned: 'The host pinned: {title}',
  liveNow: 'Live now',
  watchLive: 'Watch live: {title}',
  dismissLive: 'Dismiss live video',
} as const;

export type Key = keyof typeof en;

const es: Record<Key, string> = {
  addToCart: 'Agregar al carrito',
  adding: 'Agregando…',
  added: 'Agregado ✓',
  tryAgain: 'Reintentar',
  addFailed: 'No se pudo agregar al carrito',
  soldOut: 'Sin stock por hoy',
  viewCart: 'Ver carrito',
  loadingProducts: 'Cargando productos…',
  productsUnavailable: 'Los productos no están disponibles ahora.',
  chooseOption: 'Elegí {name}',
  closeVideo: 'Cerrar video',
  prevVideo: 'Video anterior',
  nextVideo: 'Video siguiente',
  watch: 'Ver: {title}',
  live: 'EN VIVO',
  liveSuffix: ', en vivo',
  seenSuffix: ', vista',
  openStory: 'Abrir historia: {title}',
  shopVideos: 'Comprá desde los videos',
  stories: 'Historias',
  loadingVideos: 'Cargando videos',
  loadingStories: 'Cargando historias',
  shop: 'Comprar {title}',
  productDetails: 'Detalles de {title}',
  closeProduct: 'Cerrar producto',
  liveRegion: 'En vivo',
  liveChat: 'Chat en vivo',
  message: 'Mensaje',
  saySomething: 'Escribí algo…',
  send: 'Enviar',
  sendHeart: 'Enviar un corazón',
  watching: '{n} mirando',
  guest: 'Invitado',
  pinnedByHost: 'Fijado en el vivo',
  hostPinned: 'Se fijó: {title}',
  liveNow: 'En vivo ahora',
  watchLive: 'Ver en vivo: {title}',
  dismissLive: 'Cerrar video en vivo',
};

const DICTS = { en, es } as const;
export type Lang = keyof typeof DICTS;

let current: Lang = 'en';

/** "es", "es-UY", "ES_uy" -> es. Anything we don't ship falls back to English. */
export function pickLang(tag: string | undefined | null): Lang {
  const base = (tag ?? '').toLowerCase().split(/[-_]/)[0] as Lang;
  return base in DICTS ? base : 'en';
}

export function setLang(tag: string | undefined | null) {
  current = pickLang(tag);
}

export const getLang = () => current;

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const raw = DICTS[current][key] ?? en[key];
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
