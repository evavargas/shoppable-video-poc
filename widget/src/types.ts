/** A product as the player needs it, resolved from the store itself (never trusted from our config). */
export interface Product {
  handle: string;
  title: string;
  price: number; // major units, e.g. 59 for $59.00
  currency: string;
  variantId: number; // /cart/add.js needs a variant id, not a product id
  image?: string;
  available: boolean;
}

/** A tappable chip on the video while it plays: shown between `start` and `end` seconds, at x/y percent of the frame. */
export interface Hotspot {
  handle: string; // must be one of the video's productHandles
  start: number;
  end: number;
  x: number; // 0..100, from the left
  y: number; // 0..100, from the top
}

export interface Video {
  id: string;
  src: string;
  poster?: string;
  title: string;
  label?: string; // short name under a story avatar; falls back to the title
  productHandles: string[];
  hotspots?: Hotspot[];
  liveId?: string; // present = this video has live chat and a poll
}

export type Layout = 'carousel' | 'stories' | 'floating';

/** What the backend returns for one embedding (stored in Firestore). */
export interface EmbedConfig {
  embeddingId: string;
  theme: { accent: string };
  layout?: Layout;
  videos: Video[];
  firebase?: FirebaseSettings;
}

/** Seam between the widget and the store platform: Shopify in production, a mock for local demos and tests. */
export interface Store {
  getProduct(handle: string): Promise<Product>;
  addToCart(product: Product): Promise<void>;
  /** Optional: lets the host page show an accurate cart count. */
  getCartCount?(): Promise<number | undefined>;
}

/** Public Firebase settings, delivered by the config endpoint (none of these are secrets). */
export interface FirebaseSettings {
  projectId: string;
  apiKey?: string;
  emulatorHost?: string; // "127.0.0.1:8080" when running against the emulator
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
}

export interface Poll {
  question: string;
  options: { id: string; label: string; votes: number }[];
  myVote?: string;
}

/** The live-level fields the host controls, delivered by one document listener. */
export interface LiveState {
  status: string; // 'live' | 'scheduled' | 'ended' (anything else is treated as ended by the consumer)
  pinnedProduct: string | null; // product handle the host pinned, if any
}

export interface Reaction {
  id: string;
  count: number;
  sessionId: string;
}

/** Implemented by live.js (the Firebase bundle). The main widget only knows this interface. */
export interface LiveApi {
  watchPoll(liveId: string, sessionId: string, cb: (poll: Poll | null) => void): () => void;
  /** Real-time fields of lives/{liveId} (status, pinned product); null if the document does not exist. */
  watchLive(liveId: string, cb: (state: LiveState | null) => void): () => void;
  /** Presence: write this viewer's heartbeat, remove it on leaving, and read everyone's last-seen times (ms). */
  heartbeat(liveId: string, sessionId: string): Promise<void>;
  leave(liveId: string, sessionId: string): Promise<void>;
  watchViewers(liveId: string, cb: (lastSeenMs: number[]) => void): () => void;
  /** Hearts: one write per batch; the listener only delivers batches that arrive after it started. */
  sendReactions(liveId: string, sessionId: string, count: number): Promise<void>;
  watchReactions(liveId: string, cb: (r: Reaction) => void): () => void;
  watchMessages(liveId: string, cb: (messages: ChatMessage[]) => void): () => void;
  sendMessage(liveId: string, name: string, text: string): Promise<void>;
  vote(liveId: string, sessionId: string, optionId: string): Promise<void>;
}
