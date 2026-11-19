import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { Carousel } from './components/Carousel';
import { mount } from './mount';
import { intersect } from './test-setup';
import { Live } from './components/Live';
import type { ChatMessage, EmbedConfig, LiveApi, Poll, Product, Store } from './types';

const product: Product = { handle: 'tee', title: 'Cotton Tee', price: 29, currency: 'USD', variantId: 7, available: true };
const makeStore = (p: Product = product): Store => ({
  getProduct: vi.fn().mockResolvedValue(p),
  addToCart: vi.fn().mockResolvedValue(undefined),
});
const config: EmbedConfig = {
  embeddingId: 't',
  theme: { accent: '#0b6b4f' },
  videos: [{ id: 'v1', src: 'https://x.test/v1.mp4', title: 'Summer layers', productHandles: ['tee'] }],
};

const track = vi.fn();
const connectLive = vi.fn().mockRejectedValue(new Error('no live in this test'));

beforeEach(() => vi.clearAllMocks());

describe('Carousel performance behaviour', () => {
  const onView = vi.fn();

  it('counts one view per video, only once it plays', () => {
    render(<Carousel videos={config.videos} onOpen={() => {}} onView={onView} />);
    const card = screen.getByRole('button', { name: /summer layers/i });
    intersect(card, 0.3);
    expect(onView).not.toHaveBeenCalled();
    intersect(card, 0.8);
    intersect(card, 0);
    intersect(card, 0.9);
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('sets video src only when near the viewport, plays only when mostly visible', () => {
    render(<Carousel videos={config.videos} onOpen={() => {}} onView={onView} />);
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

describe('App', () => {
  it('opens the player and adds the product to the cart', async () => {
    const store = makeStore();
    render(<App embeddingId="t" loadConfig={async () => config} store={store} track={track} connectLive={connectLive} onFail={() => {}} />);

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
    const { unmount } = render(<App embeddingId="t" loadConfig={async () => config} store={store} track={track} connectLive={connectLive} onFail={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /watch: summer layers/i }));
    await userEvent.click(await screen.findByRole('button', { name: /add to cart/i }));
    expect(await screen.findByText('All 3 are in your cart.')).toBeInTheDocument();
    expect(track).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'add_to_cart' })); // failed adds are not revenue
    unmount();

    render(<App embeddingId="t" loadConfig={async () => config} store={makeStore({ ...product, available: false })} track={track} connectLive={connectLive} onFail={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /watch: summer layers/i }));
    expect(await screen.findByRole('button', { name: /sold out/i })).toBeDisabled();
  });

  it('calls onFail when config fails to load', async () => {
    const onFail = vi.fn();
    render(<App embeddingId="t" loadConfig={() => Promise.reject(new Error('down'))} store={makeStore()} track={track} connectLive={connectLive} onFail={onFail} />);
    await vi.waitFor(() => expect(onFail).toHaveBeenCalled());
  });
});

describe('mount', () => {
  it('renders inside a shadow root and hides the host on failure', async () => {
    const host = document.createElement('div');
    host.dataset.embeddingId = 't';
    document.body.append(host);

    mount(host, { loadConfig: () => Promise.reject(new Error('down')), store: makeStore(), track, connectLive });

    expect(host.shadowRoot).not.toBeNull();
    expect(host.shadowRoot!.querySelector('style')).not.toBeNull();
    await vi.waitFor(() => expect(host.style.display).toBe('none'));
  });
});

describe('Live', () => {
  function fakeLive() {
    let onPoll: (p: Poll | null) => void = () => {};
    let onMessages: (m: ChatMessage[]) => void = () => {};
    const api: LiveApi = {
      watchPoll: vi.fn((_id, _s, cb) => {
        onPoll = cb;
        return vi.fn();
      }),
      watchMessages: vi.fn((_id, cb) => {
        onMessages = cb;
        return vi.fn();
      }),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      vote: vi.fn().mockResolvedValue(undefined),
    };
    return { api, push: { poll: (p: Poll) => act(() => onPoll(p)), messages: (m: ChatMessage[]) => act(() => onMessages(m)) } };
  }

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
