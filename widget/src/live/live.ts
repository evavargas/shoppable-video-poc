// Built as its own file (live.js) so the carousel never pays for the Firebase SDK.
// Exposed as the global `PocLive` and loaded on demand when a live video opens.
import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
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

    watchStatus(liveId, cb) {
      return onSnapshot(
        doc(db, 'lives', liveId),
        (snap) => cb(snap.exists() ? String(snap.get('status') ?? 'ended') : null),
        (err) => console.warn('[poc] status listener failed', err.code),
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
