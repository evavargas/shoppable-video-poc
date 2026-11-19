import { type FormEvent, useEffect, useState } from 'react';
import { sessionId } from '../track';
import type { ChatMessage, LiveApi, Poll } from '../types';

/** Chat + poll over a live video. If Firebase is unreachable it renders nothing: the video and cart still work. */
export function Live({ liveId, connect }: { liveId: string; connect: () => Promise<LiveApi> }) {
  const [api, setApi] = useState<LiveApi | null>(null);
  const [failed, setFailed] = useState(false);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');

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

  if (failed) return null;

  function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!api || !t) return;
    setText('');
    api.sendMessage(liveId, `Guest ${sessionId.slice(0, 4)}`, t).catch(() => setText(t));
  }

  return (
    <section className="live" aria-label="Live">
      <p className="live-title">
        <span className="badge">LIVE</span>
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
        <button type="submit" className="btn" disabled={!api}>
          Send
        </button>
      </form>
    </section>
  );
}
