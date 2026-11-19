import { type FormEvent, useEffect, useRef, useState } from 'react';
import { HANDLE, HEARTBEAT_MS, countActive, formatWatching } from '../live-utils';
import { sessionId } from '../track';
import type { ChatMessage, LiveApi, Poll } from '../types';

const REACTION_FLUSH_MS = 1000;
const MAX_REACTION_BATCH = 20;
const RECOUNT_MS = 15_000;

interface Props {
  liveId: string;
  connect: () => Promise<LiveApi>;
  /** The host pinned (or unpinned) a product. Already validated. */
  onPinned?: (handle: string | null) => void;
  /** Hearts to float over the video (ours and other viewers'). */
  onHearts?: (count: number) => void;
  /** One call per batch sent to the server, for analytics. */
  onReaction?: (count: number) => void;
}

/**
 * Chat, poll, viewer count, hearts and the host's pinned product over a live video.
 * If Firebase is unreachable it renders nothing: the video and the cart still work.
 */
export function Live({ liveId, connect, onPinned, onHearts, onReaction }: Props) {
  const [api, setApi] = useState<LiveApi | null>(null);
  const [failed, setFailed] = useState(false);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [viewerTimes, setViewerTimes] = useState<number[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [heartTotal, setHeartTotal] = useState(0);

  // Latest callbacks without re-subscribing every listener when the parent re-renders.
  const cb = useRef({ onPinned, onHearts, onReaction });
  cb.current = { onPinned, onHearts, onReaction };
  const pending = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    connect()
      .then((a) => {
        if (cancelled) return;
        setApi(a);
        const offPoll = a.watchPoll(liveId, sessionId, setPoll);
        const offChat = a.watchMessages(liveId, setMessages);
        stop = () => {
          offPoll();
          offChat();
        };
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      stop?.(); // closing the player closes the listeners: no leaked connections
    };
  }, [liveId, connect]);

  // 4a presence, 4b hearts from others, 4c pinned product: all stop when the player closes.
  useEffect(() => {
    if (!api) return;
    const beat = () => {
      if (!document.hidden) api.heartbeat(liveId, sessionId).catch(() => {}); // a hidden tab stops counting as watching
    };
    beat();
    const heartbeat = setInterval(beat, HEARTBEAT_MS);
    const recount = setInterval(() => setNow(Date.now()), RECOUNT_MS);
    const offViewers = api.watchViewers(liveId, (times) => {
      setViewerTimes(times);
      setNow(Date.now());
    });
    const offLive = api.watchLive(liveId, (state) => {
      const handle = state?.pinnedProduct;
      cb.current.onPinned?.(handle && HANDLE.test(handle) ? handle : null);
    });
    const offReactions = api.watchReactions(liveId, (r) => {
      if (r.sessionId === sessionId) return; // we already floated our own hearts when tapping
      setHeartTotal((t) => t + r.count);
      cb.current.onHearts?.(r.count);
    });
    return () => {
      clearInterval(heartbeat);
      clearInterval(recount);
      offViewers();
      offLive();
      offReactions();
      api.leave(liveId, sessionId).catch(() => {});
      cb.current.onPinned?.(null);
    };
  }, [api, liveId]);

  useEffect(() => () => clearTimeout(flushTimer.current), []);

  if (failed) return null;

  function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!api || !t) return;
    setText('');
    api.sendMessage(liveId, `Guest ${sessionId.slice(0, 4)}`, t).catch(() => setText(t));
  }

  // Hearts are cheap to show and expensive to store: animate every tap at once, but write at most one batch per second.
  function sendHeart() {
    pending.current += 1;
    setHeartTotal((t) => t + 1);
    cb.current.onHearts?.(1);
    flushTimer.current ??= setTimeout(flush, REACTION_FLUSH_MS);
  }

  function flush() {
    flushTimer.current = undefined;
    const count = Math.min(pending.current, MAX_REACTION_BATCH);
    pending.current = 0;
    if (count > 0 && api) {
      api.sendReactions(liveId, sessionId, count).catch(() => {});
      cb.current.onReaction?.(count);
    }
  }

  const watching = viewerTimes ? formatWatching(countActive(viewerTimes, now), viewerTimes.length) : null;

  return (
    <section className="live" aria-label="Live">
      <p className="live-title">
        <span className="badge">LIVE</span>
        {watching !== null && (
          <span className="watching" aria-live="off">
            {watching} watching
          </span>
        )}
      </p>
      {poll && (
        <div role="group" aria-label={poll.question}>
          <strong>{poll.question}</strong>
          <div className="options">
            {poll.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="option"
                aria-pressed={poll.myVote === o.id}
                disabled={poll.myVote !== undefined}
                onClick={() => api?.vote(liveId, sessionId, o.id).catch(() => {})}
              >
                {o.label} · {o.votes}
              </button>
            ))}
          </div>
        </div>
      )}
      <ol className="chat" role="log" aria-live="polite" aria-label="Live chat">
        {messages.map((m) => (
          <li key={m.id}>
            <strong>{m.name}:</strong> {m.text}
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={send}>
        <input aria-label="Message" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Say something…" />
        <button type="button" className="heart-btn" aria-label="Send a heart" disabled={!api} onClick={sendHeart}>
          ❤ <span aria-hidden="true">{heartTotal}</span>
        </button>
        <button type="submit" className="btn" disabled={!api}>
          Send
        </button>
      </form>
    </section>
  );
}
