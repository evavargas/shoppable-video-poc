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

export interface Video {
  id: string;
  src: string;
  poster?: string;
  title: string;
  productHandles: string[];
  liveId?: string; // present = this video has live chat and a poll
}

/** What the backend returns for one embedding (stored in Firestore). */
export interface EmbedConfig {
  embeddingId: string;
  theme: { accent: string };
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

/** Implemented by live.js (the Firebase bundle). The main widget only knows this interface. */
export interface LiveApi {
  watchPoll(liveId: string, sessionId: string, cb: (poll: Poll | null) => void): () => void;
  watchMessages(liveId: string, cb: (messages: ChatMessage[]) => void): () => void;
  sendMessage(liveId: string, name: string, text: string): Promise<void>;
  vote(liveId: string, sessionId: string, optionId: string): Promise<void>;
}
