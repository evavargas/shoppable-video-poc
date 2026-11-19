// Built as its own file (live.js) so the carousel never pays for the Firebase SDK.
// Exposed as the global `PocLive` and loaded on demand when a live video opens.
import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { VIEWER_QUERY_LIMIT } from '../live-utils';
import type { ChatMessage, FirebaseSettings, LiveApi, Poll } from '../types';

export function connect(settings: FirebaseSettings): LiveApi {
  const app = initializeApp({ projectId: settings.projectId, apiKey: settings.apiKey }, 'poc-live');
  const db = getFirestore(app);
  if (settings.emulatorHost) {
    const [host, port] = settings.emulatorHost.split(':');
    connectFirestoreEmulator(db, host ?? '127.0.0.1', Number(port));
  }

  return {
    // onSnapshot = a real-time listener: Firestore pushes every change over one open connection.
    // It returns an unsubscribe function, which React effects call on cleanup.
    watchMessages(liveId, cb) {
      const q = query(collection(db, 'lives', liveId, 'messages'), orderBy('at', 'desc'), limit(50));
      return onSnapshot(
        q,
        (snap) => {
          const messages: ChatMessage[] = snap.docs.map((d) => ({ id: d.id, name: String(d.get('name')), text: String(d.get('text')) }));
          cb(messages.reverse()); // newest first from the query, oldest first on screen
        },
        (err) => console.warn('[poc] chat listener failed', err.code),
      );
    },

    // The poll is two listeners joined: the definition (question, options) and the votes subcollection, tallied here.
    watchPoll(liveId, sessionId, cb) {
      let def: { question: string; options: { id: string; label: string }[] } | null = null;
      let votes: Record<string, string> = {}; // sessionId -> optionId
      const emit = () => {
        if (!def) return cb(null);
        const counts = new Map<string, number>();
        for (const opt of Object.values(votes)) counts.set(opt, (counts.get(opt) ?? 0) + 1);
        cb({
          question: def.question,
          options: def.options.map((o) => ({ ...o, votes: counts.get(o.id) ?? 0 })),
          myVote: votes[sessionId],
        } satisfies Poll);
      };
      const warn = (err: { code: string }) => console.warn('[poc] poll listener failed', err.code);
      const offDef = onSnapshot(
        doc(db, 'lives', liveId),
        (snap) => {
          def = snap.exists() ? (snap.data() as typeof def) : null;
          emit();
        },
        warn,
      );
      const offVotes = onSnapshot(
        collection(db, 'lives', liveId, 'votes'),
        (snap) => {
          votes = Object.fromEntries(snap.docs.map((d) => [d.id, String(d.get('option'))]));
          emit();
        },
        warn,
      );
      return () => {
        offDef();
        offVotes();
      };
    },

    // One document listener for everything the host controls on the live (status, pinned product).
    watchLive(liveId, cb) {
      return onSnapshot(
        doc(db, 'lives', liveId),
        (snap) => {
          if (!snap.exists()) return cb(null);
          const pinned = snap.get('pinnedProduct');
          cb({ status: String(snap.get('status') ?? 'ended'), pinnedProduct: typeof pinned === 'string' ? pinned : null });
        },
        (err) => console.warn('[poc] live listener failed', err.code),
      );
    },

    // Presence without onDisconnect: a heartbeat doc per viewer, counted by freshness on the client.
    async heartbeat(liveId, sessionId) {
      await setDoc(doc(db, 'lives', liveId, 'viewers', sessionId), { lastSeen: serverTimestamp() });
    },

    async leave(liveId, sessionId) {
      await deleteDoc(doc(db, 'lives', liveId, 'viewers', sessionId));
    },

    watchViewers(liveId, cb) {
      // Newest first and capped: the listener reads at most VIEWER_QUERY_LIMIT docs, so the cost is bounded.
      const q = query(collection(db, 'lives', liveId, 'viewers'), orderBy('lastSeen', 'desc'), limit(VIEWER_QUERY_LIMIT));
      return onSnapshot(
        q,
        (snap) => {
          // 'estimate': a heartbeat we just wrote has no server time yet; use our clock for it.
          cb(snap.docs.map((d) => d.get('lastSeen', { serverTimestamps: 'estimate' })?.toMillis?.() ?? 0));
        },
        (err) => console.warn('[poc] viewers listener failed', err.code),
      );
    },

    async sendReactions(liveId, sessionId, count) {
      await addDoc(collection(db, 'lives', liveId, 'reactions'), { type: 'heart', count, sessionId, at: serverTimestamp() });
    },

    watchReactions(liveId, cb) {
      const q = query(collection(db, 'lives', liveId, 'reactions'), orderBy('at', 'desc'), limit(20));
      let first = true;
      return onSnapshot(
        q,
        (snap) => {
          if (first) {
            first = false; // history: do not replay old hearts
            return;
          }
          snap.docChanges().forEach((change) => {
            if (change.type !== 'added' || change.doc.metadata.hasPendingWrites) return; // our own write echoing back
            cb({ id: change.doc.id, count: Number(change.doc.get('count')) || 1, sessionId: String(change.doc.get('sessionId')) });
          });
        },
        (err) => console.warn('[poc] reactions listener failed', err.code),
      );
    },

    async sendMessage(liveId, name, text) {
      await addDoc(collection(db, 'lives', liveId, 'messages'), { name, text, at: serverTimestamp() });
    },

    async vote(liveId, sessionId, optionId) {
      // setDoc on an existing doc is an update, which the rules forbid: one vote per session.
      await setDoc(doc(db, 'lives', liveId, 'votes', sessionId), { option: optionId });
    },
  };
}
