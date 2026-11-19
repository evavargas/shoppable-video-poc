import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { Carousel } from './components/Carousel';
import { mount } from './mount';
import { intersect } from './test-setup';
import { Live } from './components/Live';
import { Stories } from './components/Stories';
import { sessionId } from './track';
import type { ChatMessage, EmbedConfig, LiveApi, LiveState, Poll, Product, Reaction, Store } from './types';

const product: Product = { handle: 'tee', title: 'Cotton Tee', price: 29, currency: 'USD', variantId: 7, available: true };
const makeStore = (p: Product = product): Store => ({
  getProduct: vi.fn().mockResolvedValue(p),
  addToCart: vi.fn().mockResolvedValue(undefined),
  getCartCount: vi.fn().mockResolvedValue(3),
});
const config: EmbedConfig = {
  embeddingId: 't',
  theme: { accent: '#0b6b4f' },
  videos: [{ id: 'v1', src: 'https://x.test/v1.mp4', title: 'Summer layers', productHandles: ['tee'] }],
};
const twoVideos: EmbedConfig = {
  ...config,
  videos: [
    { id: 'v1', src: 'https://x.test/v1.mp4', title: 'Summer layers', productHandles: ['tee'] },
    { id: 'v2', src: 'https://x.test/v2.mp4', title: 'Winter coats', productHandles: ['tee'] },
  ],
};


/** A complete fake of live.js: every listener is captured so a test can push data, and every unsubscribe is a spy. */
function makeLiveApi() {
  const h = {
    poll: (_p: Poll | null) => {},
    messages: (_m: ChatMessage[]) => {},
    live: (_s: LiveState | null) => {},
    viewers: (_t: number[]) => {},
    reactions: (_r: Reaction) => {},
  };
  const off = { poll: vi.fn(), chat: vi.fn(), live: vi.fn(), viewers: vi.fn(), reactions: vi.fn() };
  const api: LiveApi = {
    watchPoll: vi.fn((_id, _s, cb) => ((h.poll = cb), off.poll)),
    watchMessages: vi.fn((_id, cb) => ((h.messages = cb), off.chat)),
    watchLive: vi.fn((_id, cb) => ((h.live = cb), off.live)),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
    watchViewers: vi.fn((_id, cb) => ((h.viewers = cb), off.viewers)),
    sendReactions: vi.fn().mockResolvedValue(undefined),
    watchReactions: vi.fn((_id, cb) => ((h.reactions = cb), off.reactions)),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    vote: vi.fn().mockResolvedValue(undefined),
  };
  return {
    api,
    off,
    push: {
      poll: (p: Poll) => act(() => h.poll(p)),
      messages: (m: ChatMessage[]) => act(() => h.messages(m)),
      live: (st: LiveState | null) => act(() => h.live(st)),
      viewers: (t: number[]) => act(() => h.viewers(t)),
      reaction: (r: Reaction) => act(() => h.reactions(r)),
    },
  };
}

const track = vi.fn();
const connectLive = vi.fn().mockRejectedValue(new Error('no live in this test'));
const fetchLiveStatus = vi.fn().mockResolvedValue('ended');

beforeEach(() => vi.clearAllMocks());

describe('Carousel performance behaviour', () => {
  const onView = vi.fn();

  it('counts one view per video, only once it plays', () => {
    render(<Carousel videos={config.videos} store={makeStore()} onOpen={() => {}} onView={onView} />);
    const card = screen.getByRole('button', { name: /summer layers/i });
    intersect(card, 0.3);
    expect(onView).not.toHaveBeenCalled();
    intersect(card, 0.8);
    intersect(card, 0);
    intersect(card, 0.9);
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('sets video src only when near the viewport, plays only when mostly visible', () => {
    render(<Carousel videos={config.videos} store={makeStore()} onOpen={() => {}} onView={onView} />);
    const video = document.querySelector('video')!;
    const card = screen.getByRole('button', { name: /summer layers/i });

    expect(video).not.toHaveAttribute('src');

    intersect(card, 0.2); // peeking in
    expect(video).toHaveAttribute('src', 'https://x.test/v1.mp4');
    expect(video.play).not.toHaveBeenCalled();

    intersect(card, 0.8); // mostly visible
    expect(video.play).toHaveBeenCalled();

    intersect(card, 0); // scrolled away
    expect(video.pause).toHaveBeenCalled();
  });
});

describe('Carousel card', () => {
  const rich: EmbedConfig['videos'] = [
    { id: 'v1', src: 'https://x.test/v1.mp4', poster: 'https://x.test/v1.jpg', title: 'Summer layers', productHandles: ['tee'], liveId: 'l1' },
  ];

  it('shows the poster, the product price (from the store) and a LIVE badge', async () => {
    render(<Carousel videos={rich} store={makeStore()} onOpen={() => {}} onView={() => {}} />);
    expect(document.querySelector('video')).toHaveAttribute('poster', 'https://x.test/v1.jpg');
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /watch: summer layers, live/i })).toBeInTheDocument();

    intersect(screen.getByRole('button'), 0.2); // price is fetched lazily, when the card is near the viewport
    expect(await screen.findByText('$29.00')).toBeInTheDocument();
  });

  it('shows "Sold out" instead of a price when the product is unavailable', async () => {
    render(<Carousel videos={rich} store={makeStore({ ...product, available: false })} onOpen={() => {}} onView={() => {}} />);
    intersect(screen.getByRole('button'), 0.2);
    expect(await screen.findByText('Sold out')).toBeInTheDocument();
  });

  it('does not autoplay previews when the user prefers reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true }), configurable: true });
    try {
      render(<Carousel videos={rich} store={makeStore()} onOpen={() => {}} onView={() => {}} />);
      intersect(screen.getByRole('button'), 0.9);
      expect(document.querySelector('video')!.play).not.toHaveBeenCalled();
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia; // jsdom has none by default
    }
  });
});

describe('Player', () => {
  const openPlayer = async (store = makeStore()) => {
    render(<App embeddingId="t" loadConfig={async () => twoVideos} store={store} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /watch: summer layers/i }));
    await screen.findByRole('dialog');
  };
  const counter = () => document.querySelector('.counter')!.textContent;

  it('moves between videos with buttons, arrow keys and swipes, tracking each opened video', async () => {
    await openPlayer();
    expect(counter()).toContain('1/2');
    expect(screen.getByRole('button', { name: 'Previous video' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next video' }));
    expect(document.querySelectorAll('dialog video')).toHaveLength(1); // the previous video element is replaced, not kept
    expect(counter()).toContain('Winter coats · 2/2');
    expect(track).toHaveBeenCalledWith({ type: 'video_click', videoId: 'v2' });
    expect(screen.getByRole('button', { name: 'Next video' })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowUp' });
    expect(counter()).toContain('1/2');

    const stage = document.querySelector('.stage')!;
    fireEvent.touchStart(stage, { touches: [{ clientX: 100, clientY: 400 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 105, clientY: 250 }] }); // swipe up
    expect(counter()).toContain('2/2');

    fireEvent.touchStart(stage, { touches: [{ clientX: 100, clientY: 300 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 220, clientY: 330 }] }); // short, mostly sideways: ignored
    expect(counter()).toContain('2/2');
  });

  it('tells the host page the cart changed, with the real count from the store', async () => {
    const heard = vi.fn();
    window.addEventListener('poc:cart-add', (e) => heard((e as CustomEvent).detail));
    await openPlayer();
    await userEvent.click(await screen.findByRole('button', { name: /add to cart/i }));
    await vi.waitFor(() => expect(heard).toHaveBeenCalledWith(expect.objectContaining({ handle: 'tee', count: 3 })));
  });

  it('closes with the close button after the exit animation', async () => {
    await openPlayer();
    await userEvent.click(screen.getByRole('button', { name: 'Close video' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Hotspots', () => {
  const withHotspots: EmbedConfig = {
    ...config,
    videos: [
      {
        id: 'v1',
        src: 'https://x.test/v1.mp4',
        title: 'Summer layers',
        productHandles: ['tee'],
        hotspots: [{ handle: 'tee', start: 2, end: 5, x: 30, y: 40 }],
      },
    ],
  };
  const seek = (t: number) => {
    const video = document.querySelector('dialog video')!;
    Object.defineProperty(video, 'currentTime', { value: t, configurable: true });
    act(() => {
      fireEvent.timeUpdate(video);
    });
  };
  const open = async (store = makeStore(), cfg = withHotspots) => {
    render(<App embeddingId="t" loadConfig={async () => cfg} store={store} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /watch: summer layers/i }));
    await screen.findByRole('dialog');
    return store;
  };

  it('shows the chip only during its time window, positioned at x/y percent', async () => {
    await open();
    seek(1);
    expect(screen.queryByRole('button', { name: 'Shop Cotton Tee' })).toBeNull();
    seek(3);
    const chip = await screen.findByRole('button', { name: 'Shop Cotton Tee' });
    expect(chip).toHaveStyle({ left: '30%', top: '40%' });
    seek(5); // end is exclusive
    expect(screen.queryByRole('button', { name: 'Shop Cotton Tee' })).toBeNull();
  });

  it('opens the product card on tap, pauses the video, tracks it, and adds to cart from the card', async () => {
    const store = await open();
    seek(3);
    await userEvent.click(await screen.findByRole('button', { name: 'Shop Cotton Tee' }));

    const card = await screen.findByRole('region', { name: /cotton tee details/i });
    expect(track).toHaveBeenCalledWith({ type: 'hotspot_click', videoId: 'v1', productHandle: 'tee' });
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    const add = card.querySelector('.btn') as HTMLElement;
    await userEvent.click(add);
    expect(store.addToCart).toHaveBeenCalledWith(product);
    await vi.waitFor(() =>
      expect(track).toHaveBeenCalledWith({ type: 'add_to_cart', videoId: 'v1', productHandle: 'tee', value: 29, currency: 'USD' }),
    );

    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Close product' }));
    expect(screen.queryByRole('region', { name: /details/i })).toBeNull();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled(); // resumes
  });

  it('Esc closes the product card first, and the player only on the next Esc', async () => {
    await open();
    seek(3);
    await userEvent.click(await screen.findByRole('button', { name: 'Shop Cotton Tee' }));
    await screen.findByRole('region', { name: /details/i });

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('region', { name: /details/i })).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('flips the chip to the left of its dot near the right edge, and skips products that fail to load', async () => {
    const right: EmbedConfig = {
      ...withHotspots,
      videos: [{ ...withHotspots.videos[0]!, hotspots: [{ handle: 'tee', start: 0, end: 5, x: 85, y: 20 }] }],
    };
    await open(makeStore(), right);
    seek(1);
    expect(await screen.findByRole('button', { name: 'Shop Cotton Tee' })).toHaveClass('flip');
  });

  it('renders no chip when the product cannot be loaded', async () => {
    const broken: Store = { ...makeStore(), getProduct: vi.fn().mockRejectedValue(new Error('404')) };
    await open(broken);
    seek(3);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /shop/i })).toBeNull();
  });
});

describe('Stories layout', () => {
  const storiesConfig: EmbedConfig = {
    ...twoVideos,
    layout: 'stories',
    videos: [
      { ...twoVideos.videos[0]!, label: 'Layers', poster: 'https://x.test/1.jpg', liveId: 'l1' },
      { ...twoVideos.videos[1]!, label: 'Coats' },
    ],
  };
  const renderStories = () =>
    render(<App embeddingId="s" loadConfig={async () => storiesConfig} store={makeStore()} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} layoutHint="stories" />);

  beforeEach(() => sessionStorage.clear());

  it('shows the loading skeleton at the stories height, then round avatars with labels and a LIVE badge', async () => {
    let release: (c: EmbedConfig) => void = () => {};
    render(
      <App embeddingId="s" loadConfig={() => new Promise((r) => (release = r))} store={makeStore()} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} layoutHint="stories" />,
    );
    expect(screen.getByLabelText('Loading stories')).toBeInTheDocument();
    await act(async () => release(storiesConfig));
    expect(await screen.findByRole('list', { name: 'Stories' })).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /shop the videos/i })).toBeNull(); // not the carousel
  });

  it('tracks story_open (not video_click), marks the story seen for the session, and opens the player with progress bars', async () => {
    renderStories();
    await userEvent.click(await screen.findByRole('button', { name: /open story: summer layers, live$/i }));
    await screen.findByRole('dialog');

    expect(track).toHaveBeenCalledWith({ type: 'story_open', videoId: 'v1' });
    expect(track).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'video_click' }));
    expect(document.querySelectorAll('.seg')).toHaveLength(2);
    expect(JSON.parse(sessionStorage.getItem('poc-seen:s')!)).toEqual(['v1']);
  });

  it('shows the ring as seen on the next visit in the same session', async () => {
    sessionStorage.setItem('poc-seen:s', JSON.stringify(['v2']));
    renderStories();
    expect(await screen.findByRole('button', { name: /open story: winter coats, seen/i })).toHaveClass('seen');
    expect(screen.getByRole('button', { name: /open story: summer layers/i })).not.toHaveClass('seen');
  });

  it('counts one view per avatar, only once it is on screen', async () => {
    const onView = vi.fn();
    render(<Stories videos={storiesConfig.videos} seen={new Set()} onOpen={() => {}} onView={onView} />);
    const avatar = screen.getByRole('button', { name: /summer layers/i });
    intersect(avatar, 0.3);
    expect(onView).not.toHaveBeenCalled();
    intersect(avatar, 0.9);
    intersect(avatar, 0);
    intersect(avatar, 0.9);
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('fills the progress bar with playback and moves to the next story when one ends; the last one closes the player', async () => {
    renderStories();
    await userEvent.click(await screen.findByRole('button', { name: /open story: summer layers/i }));
    await screen.findByRole('dialog');
    const video = () => document.querySelector('dialog video')!;
    expect(video()).not.toHaveAttribute('loop'); // stories play once

    Object.defineProperty(video(), 'duration', { value: 10, configurable: true });
    Object.defineProperty(video(), 'currentTime', { value: 4, configurable: true });
    act(() => {
      fireEvent.timeUpdate(video());
    });
    expect((document.querySelectorAll('.fill')[0] as HTMLElement).style.width).toBe('40%');

    act(() => {
      fireEvent.ended(video());
    });
    expect(document.querySelector('.counter')!.textContent).toContain('2/2');
    expect(track).toHaveBeenCalledWith({ type: 'story_open', videoId: 'v2' });
    expect((document.querySelectorAll('.fill')[0] as HTMLElement).style.width).toBe('100%'); // previous story is complete

    act(() => {
      fireEvent.ended(video());
    });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Floating live mini-player', () => {
  const floating: EmbedConfig = {
    ...twoVideos,
    layout: 'floating',
    firebase: { projectId: 'p' }, // without it the widget can't reach live.js
    videos: [twoVideos.videos[0]!, { ...twoVideos.videos[1]!, liveId: 'l1', poster: 'https://x.test/2.jpg' }],
  };

  function fakeApi() {
    const f = makeLiveApi();
    return { api: f.api, stop: f.off.live, status: (st: string | null) => f.push.live(st === null ? null : { status: st, pinnedProduct: null }) };
  }

  const mountMini = (status: string, connect = connectLive) => {
    const check = vi.fn().mockResolvedValue(status);
    render(<App embeddingId="m" loadConfig={async () => floating} store={makeStore()} track={track} connectLive={connect} fetchLiveStatus={check} layoutHint="floating" onFail={() => {}} />);
    return check;
  };

  beforeEach(() => sessionStorage.clear());

  it('shows nothing, and never loads live.js, when no live is on', async () => {
    const connect = vi.fn();
    const check = mountMini('ended', connect);
    await vi.waitFor(() => expect(check).toHaveBeenCalledWith('l1'));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(connect).not.toHaveBeenCalled(); // lazy: no Firebase for pages without a live
  });

  it('appears when a live is on, loads live.js, and follows the host ending and restarting the live', async () => {
    const { api, stop, status } = fakeApi();
    mountMini('live', vi.fn().mockResolvedValue(api));

    const mini = await screen.findByRole('complementary', { name: 'Live now' });
    expect(mini).toHaveTextContent('LIVE');
    expect(track).toHaveBeenCalledWith({ type: 'view', videoId: 'v2' });
    await vi.waitFor(() => expect(api.watchLive).toHaveBeenCalledWith('l1', expect.any(Function)));

    status('ended');
    expect(screen.queryByRole('complementary')).toBeNull();
    status('live');
    expect(await screen.findByRole('complementary')).toBeInTheDocument();
    expect(track.mock.calls.filter(([e]) => e.type === 'view')).toHaveLength(1); // still one impression
    expect(stop).not.toHaveBeenCalled();
  });

  it('tells the page while it is visible (attribute + height) and clears it when dismissed', async () => {
    mountMini('live', vi.fn().mockResolvedValue(fakeApi().api));
    await screen.findByRole('complementary');
    expect(document.documentElement.dataset.pocMini).toBe('visible');
    expect(document.documentElement.style.getPropertyValue('--poc-mini-clearance')).toMatch(/px$/);

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss live video' }));
    expect(document.documentElement.dataset.pocMini).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--poc-mini-clearance')).toBe('');
  });

  it('dismiss hides it, remembers for the session, and a later page does no work at all', async () => {
    const { api, stop } = fakeApi();
    const connect = vi.fn().mockResolvedValue(api);
    const { unmount } = render(
      <App embeddingId="m" loadConfig={async () => floating} store={makeStore()} track={track} connectLive={connect} fetchLiveStatus={vi.fn().mockResolvedValue('live')} layoutHint="floating" onFail={() => {}} />,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss live video' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(sessionStorage.getItem('poc-mini-dismissed:m')).toBe('1');
    expect(stop).toHaveBeenCalled(); // listener closed
    unmount();

    connect.mockClear();
    const check = mountMini('live', connect);
    await new Promise((r) => setTimeout(r, 50));
    expect(check).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('expands into the full player on the live video, hides itself meanwhile, and returns after closing', async () => {
    mountMini('live', vi.fn().mockResolvedValue(fakeApi().api));
    await userEvent.click(await screen.findByRole('button', { name: /watch live: winter coats/i }));

    await screen.findByRole('dialog');
    expect(document.querySelector('.counter')!.textContent).toContain('Winter coats · 2/2');
    expect(track).toHaveBeenCalledWith({ type: 'video_click', videoId: 'v2' });
    expect(screen.queryByRole('complementary')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Close video' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByRole('complementary')).toBeInTheDocument();
  });

  it('stays hidden when the status check fails, and works when sessionStorage is blocked', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    const { unmount } = render(
      <App embeddingId="m" loadConfig={async () => floating} store={makeStore()} track={track} connectLive={connectLive} fetchLiveStatus={failing} layoutHint="floating" onFail={() => {}} />,
    );
    await vi.waitFor(() => expect(failing).toHaveBeenCalled());
    expect(screen.queryByRole('complementary')).toBeNull();
    unmount();

    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      mountMini('live', vi.fn().mockResolvedValue(fakeApi().api));
      expect(await screen.findByRole('complementary')).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it('does not autoplay the preview for users who prefer reduced motion', async () => {
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true }), configurable: true });
    try {
      mountMini('live', vi.fn().mockResolvedValue(fakeApi().api));
      await screen.findByRole('complementary');
      expect(document.querySelector('.mini video')).not.toHaveAttribute('autoplay');
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });
});

describe('Variant picker (Shopify options)', () => {
  const coffee: Product = {
    handle: 'cappu',
    title: 'Cappuccino',
    price: 220,
    currency: 'USD',
    variantId: 10,
    available: true,
    options: [
      { name: 'Leche', values: ['Entera', 'Avena'] },
      { name: 'Temperatura', values: ['Caliente', 'Fría'] },
    ],
    variants: [
      { id: 10, title: 'Entera / Caliente', available: true, price: 220, options: ['Entera', 'Caliente'] },
      { id: 11, title: 'Entera / Fría', available: true, price: 220, options: ['Entera', 'Fría'] },
      { id: 12, title: 'Avena / Caliente', available: true, price: 250, options: ['Avena', 'Caliente'] },
      { id: 13, title: 'Avena / Fría', available: false, price: 250, options: ['Avena', 'Fría'] },
    ],
  };
  const cfg: EmbedConfig = { ...config, videos: [{ id: 'v1', src: 'https://x.test/v1.mp4', title: 'Café', productHandles: ['cappu'] }] };

  const open = async () => {
    const store = makeStore(coffee);
    render(<App embeddingId="t" loadConfig={async () => cfg} store={store} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /watch: café/i }));
    await screen.findByRole('dialog');
    return store;
  };

  it('shows one select per option, starting on the default variant', async () => {
    await open();
    expect(await screen.findByRole('combobox', { name: 'Choose Leche' })).toHaveValue('Entera');
    expect(screen.getByRole('combobox', { name: 'Choose Temperatura' })).toHaveValue('Caliente');
  });

  it('adds the chosen variant with its own id and price, and tracks that price', async () => {
    const store = await open();
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Choose Leche' }), 'Avena');
    expect(screen.getByText('$250.00')).toBeInTheDocument(); // the price follows the variant

    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(store.addToCart).toHaveBeenCalledWith(expect.objectContaining({ variantId: 12, price: 250, variantTitle: 'Avena / Caliente' }));
    await vi.waitFor(() => expect(track).toHaveBeenCalledWith({ type: 'add_to_cart', videoId: 'v1', productHandle: 'cappu', value: 250, currency: 'USD' }));
  });

  it('disables a combination that is sold out', async () => {
    await open();
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Choose Leche' }), 'Avena');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Choose Temperatura' }), 'Fría');
    expect(screen.getByRole('button', { name: /sold out/i })).toBeDisabled();
  });

  it('tells the host page which variant was added, so the store can build its cart line', async () => {
    const heard = vi.fn();
    const listener = (e: Event) => heard((e as CustomEvent).detail);
    window.addEventListener('poc:cart-add', listener);
    try {
      await open();
      await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Choose Temperatura' }), 'Fría');
      await userEvent.click(screen.getByRole('button', { name: /add to cart/i }));
      await vi.waitFor(() =>
        expect(heard).toHaveBeenCalledWith(expect.objectContaining({ handle: 'cappu', variantId: 11, variantTitle: 'Entera / Fría', price: 220, currency: 'USD' })),
      );
    } finally {
      window.removeEventListener('poc:cart-add', listener);
    }
  });
});

describe('App', () => {
  it('opens the player and adds the product to the cart', async () => {
    const store = makeStore();
    render(<App embeddingId="t" loadConfig={async () => config} store={store} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} />);

    await userEvent.click(await screen.findByRole('button', { name: /watch: summer layers/i }));
    await userEvent.click(await screen.findByRole('button', { name: /add to cart/i }));

    expect(store.getProduct).toHaveBeenCalledWith('tee');
    expect(store.addToCart).toHaveBeenCalledWith(product);
    expect(track).toHaveBeenCalledWith({ type: 'video_click', videoId: 'v1' });
    expect(track).toHaveBeenCalledWith({ type: 'add_to_cart', videoId: 'v1', productHandle: 'tee', value: 29, currency: 'USD' });
    expect(await screen.findByRole('button', { name: /added/i })).toBeInTheDocument();
  });

  it('shows Shopify\'s error when add to cart fails, and disables sold-out products', async () => {
    const store = makeStore();
    vi.mocked(store.addToCart).mockRejectedValue(new Error('All 3 are in your cart.'));
    const { unmount } = render(<App embeddingId="t" loadConfig={async () => config} store={store} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /watch: summer layers/i }));
    await userEvent.click(await screen.findByRole('button', { name: /add to cart/i }));
    expect(await screen.findByText('All 3 are in your cart.')).toBeInTheDocument();
    expect(track).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'add_to_cart' })); // failed adds are not revenue
    unmount();

    render(<App embeddingId="t" loadConfig={async () => config} store={makeStore({ ...product, available: false })} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /watch: summer layers/i }));
    expect(await screen.findByRole('button', { name: /sold out/i })).toBeDisabled();
  });

  it('calls onFail when config fails to load', async () => {
    const onFail = vi.fn();
    render(<App embeddingId="t" loadConfig={() => Promise.reject(new Error('down'))} store={makeStore()} track={track} connectLive={connectLive} fetchLiveStatus={fetchLiveStatus} onFail={onFail} />);
    await vi.waitFor(() => expect(onFail).toHaveBeenCalled());
  });
});

describe('mount', () => {
  it('renders inside a shadow root and hides the host on failure', async () => {
    const host = document.createElement('div');
    host.dataset.embeddingId = 't';
    document.body.append(host);

    mount(host, { loadConfig: () => Promise.reject(new Error('down')), store: makeStore(), track, connectLive, fetchLiveStatus });

    expect(host.shadowRoot).not.toBeNull();
    expect(host.shadowRoot!.querySelector('style')).not.toBeNull();
    await vi.waitFor(() => expect(host.style.display).toBe('none'));
  });
});

describe('Live', () => {
  const fakeLive = () => {
    const f = makeLiveApi();
    return { api: f.api, push: f.push };
  };

  it('shows realtime chat and poll, sends messages and votes', async () => {
    const { api, push } = fakeLive();
    render(<Live liveId="l1" connect={async () => api} />);
    await screen.findByRole('log');

    push.messages([{ id: '1', name: 'Host', text: 'Welcome!' }]);
    expect(screen.getByText('Welcome!')).toBeInTheDocument();

    push.poll({ question: 'Which first?', options: [{ id: 'a', label: 'Tee', votes: 2 }, { id: 'b', label: 'Bag', votes: 0 }] });
    await userEvent.click(screen.getByRole('button', { name: /tee · 2/i }));
    expect(api.vote).toHaveBeenCalledWith('l1', expect.any(String), 'a');

    push.poll({ question: 'Which first?', options: [{ id: 'a', label: 'Tee', votes: 3 }, { id: 'b', label: 'Bag', votes: 0 }], myVote: 'a' });
    expect(screen.getByRole('button', { name: /tee · 3/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /bag/i })).toBeDisabled(); // one vote per session

    await userEvent.type(screen.getByLabelText('Message'), 'Hello{enter}');
    expect(api.sendMessage).toHaveBeenCalledWith('l1', expect.stringContaining('Guest'), 'Hello');
  });

  it('unsubscribes listeners on unmount, and renders nothing when Firebase fails', async () => {
    const { api } = fakeLive();
    const { unmount } = render(<Live liveId="l1" connect={async () => api} />);
    await screen.findByRole('log');
    const offChat = vi.mocked(api.watchMessages).mock.results[0]!.value as () => void;
    unmount();
    expect(offChat).toHaveBeenCalled();

    const { container } = render(<Live liveId="l1" connect={() => Promise.reject(new Error('blocked'))} />);
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('Live extras: viewer count (4a)', () => {
  const connected = async (props: Partial<Parameters<typeof Live>[0]> = {}) => {
    const f = makeLiveApi();
    const view = render(<Live liveId="l1" connect={async () => f.api} {...props} />);
    await act(async () => {}); // let connect() resolve
    return { ...f, ...view };
  };

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('writes a heartbeat on join and every 30 s, skips it while the tab is hidden, and leaves on close', async () => {
    vi.useFakeTimers();
    const { api, unmount, off } = await connected();
    expect(api.heartbeat).toHaveBeenCalledTimes(1);
    expect(api.heartbeat).toHaveBeenCalledWith('l1', sessionId);

    act(() => vi.advanceTimersByTime(30_000));
    expect(api.heartbeat).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => vi.advanceTimersByTime(60_000));
    expect(api.heartbeat).toHaveBeenCalledTimes(2); // a hidden tab stops counting as watching

    unmount();
    expect(api.leave).toHaveBeenCalledWith('l1', sessionId);
    expect(off.viewers).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(api.heartbeat).toHaveBeenCalledTimes(2); // timers are gone
  });

  it('counts only fresh heartbeats, and recounts over time because nothing changes when someone leaves', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    const { push } = await connected();
    const now = Date.now();
    push.viewers([now, now - 10_000, now - 74_000, now - 200_000]); // the last one is stale
    expect(screen.getByText('3 watching')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(30_000)); // no new data, but time passed: the 74 s-old heartbeat is now stale (104 s)
    expect(screen.getByText('2 watching')).toBeInTheDocument();
  });

  it('shows "100+" when the capped listener is full, and nothing before the first snapshot', async () => {
    const { push } = await connected();
    expect(screen.queryByText(/watching/)).toBeNull();
    push.viewers(Array.from({ length: 100 }, () => Date.now()));
    expect(screen.getByText('100+ watching')).toBeInTheDocument();
  });
});

describe('Live extras: hearts (4b)', () => {
  const connected = async (props: Partial<Parameters<typeof Live>[0]> = {}) => {
    const f = makeLiveApi();
    const view = render(<Live liveId="l1" connect={async () => f.api} {...props} />);
    await act(async () => {});
    return { ...f, ...view };
  };

  afterEach(() => vi.useRealTimers());

  it('floats every tap at once but writes one batch per second', async () => {
    vi.useFakeTimers();
    const onHearts = vi.fn();
    const onReaction = vi.fn();
    const { api } = await connected({ onHearts, onReaction });
    const button = screen.getByRole('button', { name: 'Send a heart' });

    for (let i = 0; i < 3; i++) fireEvent.click(button);
    expect(onHearts).toHaveBeenCalledTimes(3);
    expect(api.sendReactions).not.toHaveBeenCalled();
    expect(button).toHaveTextContent('3'); // running counter

    act(() => vi.advanceTimersByTime(1000));
    expect(api.sendReactions).toHaveBeenCalledTimes(1);
    expect(api.sendReactions).toHaveBeenCalledWith('l1', sessionId, 3);
    expect(onReaction).toHaveBeenCalledWith(3);

    act(() => vi.advanceTimersByTime(5000));
    expect(api.sendReactions).toHaveBeenCalledTimes(1); // idle: nothing more is written
  });

  it('caps a batch at 20 hearts however fast the user taps', async () => {
    vi.useFakeTimers();
    const { api } = await connected();
    const button = screen.getByRole('button', { name: 'Send a heart' });
    for (let i = 0; i < 35; i++) fireEvent.click(button);
    act(() => vi.advanceTimersByTime(1000));
    expect(api.sendReactions).toHaveBeenCalledWith('l1', sessionId, 20);
  });

  it("floats other viewers' hearts but not our own echo", async () => {
    const onHearts = vi.fn();
    const { push } = await connected({ onHearts });
    push.reaction({ id: 'r1', count: 5, sessionId: 'someone-else' });
    expect(onHearts).toHaveBeenCalledWith(5);
    onHearts.mockClear();
    push.reaction({ id: 'r2', count: 5, sessionId });
    expect(onHearts).not.toHaveBeenCalled();
  });
});

describe('Live extras in the player: hearts layer and pinned product (4b, 4c)', () => {
  const liveConfig: EmbedConfig = {
    ...config,
    firebase: { projectId: 'p' },
    videos: [{ id: 'v1', src: 'https://x.test/v1.mp4', title: 'Summer layers', productHandles: ['tee'], liveId: 'l1' }],
  };
  const hatStore = (): Store => ({
    getProduct: vi.fn(async (h: string) => ({ ...product, handle: h, title: h === 'hat' ? 'Wool Hat' : 'Cotton Tee', price: h === 'hat' ? 35 : 29 })),
    addToCart: vi.fn().mockResolvedValue(undefined),
  });

  const openLive = async (store = hatStore()) => {
    const f = makeLiveApi();
    render(<App embeddingId="t" loadConfig={async () => liveConfig} store={store} track={track} connectLive={async () => f.api} fetchLiveStatus={fetchLiveStatus} onFail={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /watch: summer layers, live/i }));
    await screen.findByRole('log'); // live panel connected
    await vi.waitFor(() => expect(f.api.watchLive).toHaveBeenCalled());
    return { ...f, store };
  };
  const hearts = () => document.querySelectorAll('.heart');

  it('floats at most 8 hearts per burst and 30 on screen, and removes them by timer when no animation runs', async () => {
    const { push } = await openLive(); // open first: findBy* and userEvent need real timers
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      push.reaction({ id: 'a', count: 20, sessionId: 'x' });
      expect(hearts()).toHaveLength(8); // one burst is capped

      for (let i = 0; i < 5; i++) push.reaction({ id: `b${i}`, count: 8, sessionId: 'x' });
      expect(hearts()).toHaveLength(30); // the screen is capped

      act(() => vi.advanceTimersByTime(2100));
      expect(hearts()).toHaveLength(0); // the safety-net timer removed them, although no CSS animation ran in jsdom
    } finally {
      vi.useRealTimers();
    }
  });

  it('floats nothing under reduced motion, but still counts', async () => {
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true }), configurable: true });
    try {
      const { push } = await openLive();
      push.reaction({ id: 'a', count: 5, sessionId: 'x' });
      expect(hearts()).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Send a heart' })).toHaveTextContent('5');
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('tracks a reaction batch with its count', async () => {
    await openLive(); // open first: findBy* and userEvent need real timers
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const heart = screen.getByRole('button', { name: 'Send a heart' });
      fireEvent.click(heart);
      fireEvent.click(heart);
      act(() => vi.advanceTimersByTime(1000));
      expect(track).toHaveBeenCalledWith({ type: 'reaction', videoId: 'v1', count: 2 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the pinned product, swaps it, announces it, and removes it when unpinned', async () => {
    const { push } = await openLive();
    expect(screen.queryByText(/pinned by the host/i)).toBeNull();

    push.live({ status: 'live', pinnedProduct: 'tee' });
    expect(await screen.findByText(/pinned by the host/i)).toBeInTheDocument();
    expect(await screen.findByText('The host pinned: Cotton Tee')).toBeInTheDocument();

    push.live({ status: 'live', pinnedProduct: 'hat' });
    expect(await screen.findByText('The host pinned: Wool Hat')).toBeInTheDocument();
    expect(screen.queryByText('The host pinned: Cotton Tee')).toBeNull();

    push.live({ status: 'live', pinnedProduct: null });
    expect(screen.queryByText(/pinned by the host/i)).toBeNull();
  });

  it('ignores an invalid pinned handle', async () => {
    const { push } = await openLive();
    push.live({ status: 'live', pinnedProduct: '../../etc/passwd' });
    expect(screen.queryByText(/pinned by the host/i)).toBeNull();
  });

  it('shows nothing when the pinned product cannot be loaded', async () => {
    const store = hatStore();
    const original = vi.mocked(store.getProduct).getMockImplementation()!;
    vi.mocked(store.getProduct).mockImplementation(async (h) => {
      if (h === 'ghost') throw new Error('404');
      return original(h);
    });
    const { push } = await openLive(store);
    push.live({ status: 'live', pinnedProduct: 'ghost' });
    await vi.waitFor(() => expect(store.getProduct).toHaveBeenCalledWith('ghost'));
    expect(screen.queryByText(/pinned by the host/i)).toBeNull();
  });

  it('adds the pinned product to the cart and tracks it against the video being watched', async () => {
    const { push, store } = await openLive();
    push.live({ status: 'live', pinnedProduct: 'hat' });
    const pinned = (await screen.findByText(/pinned by the host/i)).closest('.pinned') as HTMLElement;
    await userEvent.click(pinned.querySelector('.btn') as HTMLElement);

    expect(store.addToCart).toHaveBeenCalledWith(expect.objectContaining({ handle: 'hat' }));
    await vi.waitFor(() =>
      expect(track).toHaveBeenCalledWith({ type: 'add_to_cart', videoId: 'v1', productHandle: 'hat', value: 35, currency: 'USD' }),
    );
  });
});
