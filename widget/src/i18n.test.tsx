import { render, screen } from '@testing-library/react';
import { Carousel } from './components/Carousel';
import { formatPrice } from './format';
import { getLang, pickLang, setLang, t } from './i18n';
import type { Store, Video } from './types';

afterEach(() => {
  setLang('en');
  document.documentElement.lang = '';
});

describe('pickLang', () => {
  it.each([
    ['es', 'es'],
    ['es-UY', 'es'],
    ['ES_uy', 'es'],
    ['en-US', 'en'],
    ['fr', 'en'], // not shipped: English
    ['', 'en'],
    [undefined, 'en'],
    [null, 'en'],
  ])('%p -> %s', (tag, expected) => {
    expect(pickLang(tag as string | undefined)).toBe(expected);
  });
});

describe('t', () => {
  it('translates and interpolates', () => {
    expect(t('watch', { title: 'Café' })).toBe('Watch: Café');
    setLang('es-UY');
    expect(getLang()).toBe('es');
    expect(t('watch', { title: 'Café' })).toBe('Ver: Café');
    expect(t('watching', { n: 3 })).toBe('3 mirando');
    expect(t('soldOut')).toBe('Sin stock por hoy');
  });

  it('keeps an unknown placeholder visible instead of printing "undefined"', () => {
    expect(t('watch')).toBe('Watch: {title}');
  });
});

describe('the widget speaks the language of the page', () => {
  const videos: Video[] = [{ id: 'v1', src: 'https://x.test/v.mp4', title: 'Rolls', productHandles: ['roll'], liveId: 'l1' }];
  const store: Store = { getProduct: vi.fn().mockRejectedValue(new Error('x')), addToCart: vi.fn() };

  it('renders Spanish labels for Spanish pages', () => {
    setLang('es');
    render(<Carousel videos={videos} store={store} onOpen={() => {}} onView={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ver: Rolls, en vivo' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Comprá desde los videos' })).toBeInTheDocument();
    expect(screen.getByText('EN VIVO')).toBeInTheDocument();
  });

  it('renders English otherwise', () => {
    render(<Carousel videos={videos} store={store} onOpen={() => {}} onView={() => {}} />);
    expect(screen.getByRole('button', { name: 'Watch: Rolls, live' })).toBeInTheDocument();
  });
});

describe('formatPrice follows the page locale', () => {
  it('formats Uruguayan pesos the Uruguayan way on an es-UY page', () => {
    document.documentElement.lang = 'es-UY';
    const text = formatPrice({ price: 1250.5, currency: 'UYU' });
    expect(text).toContain('1.250,50');
    expect(text).toContain('$');
  });

  it('falls back to the browser locale when the page declares none', () => {
    expect(formatPrice({ price: 5, currency: 'USD' })).toContain('5');
  });
});
