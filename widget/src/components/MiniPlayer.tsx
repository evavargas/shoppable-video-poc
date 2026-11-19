import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../format';
import { t } from '../i18n';
import type { LiveApi, Video } from '../types';

const read = (key: string) => {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false; // storage blocked: behave as "not dismissed"
  }
};

interface Props {
  embeddingId: string;
  videos: Video[];
  fetchLiveStatus: (liveId: string) => Promise<string>;
  connectLive: () => Promise<LiveApi>;
  onView: (video: Video) => void;
  onOpen: (index: number) => void;
  hidden: boolean; // true while the full player is open
}

/**
 * Small floating player, bottom-right of the page, shown only while a live is on.
 *
 * Cost control, in order:
 *  1. dismissed this session -> does nothing at all (no request, no Firebase)
 *  2. one tiny cached request asks "is a live on?" -> if not, stops there
 *  3. only when a live IS on does it load live.js and listen in real time for the host ending it
 */
export function MiniPlayer({ embeddingId, videos, fetchLiveStatus, connectLive, onView, onOpen, hidden }: Props) {
  const dismissKey = `poc-mini-dismissed:${embeddingId}`;
  const index = videos.findIndex((v) => v.liveId);
  const video = videos[index];
  const liveId = video?.liveId;
  const [dismissed, setDismissed] = useState(() => read(dismissKey));
  const [live, setLive] = useState(false);
  const [watching, setWatching] = useState(false);
  const viewed = useRef(false);

  // 1 + 2: the cheap check.
  useEffect(() => {
    if (!liveId || dismissed) return;
    let off = false;
    fetchLiveStatus(liveId)
      .then((s) => {
        if (off || s !== 'live') return;
        setLive(true);
        setWatching(true);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [liveId, dismissed, fetchLiveStatus]);

  // 3: real-time updates, only after the check said "live". Also brings the mini-player back if the host restarts the live.
  useEffect(() => {
    if (!watching || !liveId || dismissed) return;
    let off = false;
    let stop: (() => void) | undefined;
    connectLive()
      .then((api) => {
        if (off) return;
        stop = api.watchLive(liveId, (state) => setLive(state?.status === 'live'));
      })
      .catch(() => {}); // can't listen: the mini-player stays as it was, which is fine
    return () => {
      off = true;
      stop?.();
    };
  }, [watching, liveId, dismissed, connectLive]);

  const visible = Boolean(video) && live && !dismissed && !hidden;

  useEffect(() => {
    if (visible && video && !viewed.current) {
      viewed.current = true;
      onView(video); // one impression per page load
    }
  }, [visible, video, onView]);

  if (!visible || !video) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissKey, '1');
    } catch {
      /* not worth failing for */
    }
  }

  return (
    <div className="mini" role="complementary" aria-label={t('liveNow')}>
      <button type="button" className="mini-open" aria-label={t('watchLive', { title: video.title })} onClick={() => onOpen(index)}>
        <video src={video.src} poster={video.poster} muted loop playsInline autoPlay={!prefersReducedMotion()} />
        <span className="live-pill" aria-hidden="true">
          <span className="dot" />
          {t('live')}
        </span>
        <span className="mini-title">{video.title}</span>
      </button>
      <button type="button" className="mini-close" aria-label={t('dismissLive')} onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
