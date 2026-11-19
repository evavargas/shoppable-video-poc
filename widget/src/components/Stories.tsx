import { useEffect, useRef } from 'react';
import type { Video } from '../types';
import { useInView } from './useInView';

interface AvatarProps {
  video: Video;
  seen: boolean;
  onOpen: () => void;
  onView: (v: Video) => void;
}

function Avatar({ video, seen, onOpen, onView }: AvatarProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const viewed = useRef(false);
  const visible = useInView(ref, 0.6);
  // One impression per story per page load, when the avatar is actually on screen.
  useEffect(() => {
    if (visible && !viewed.current) {
      viewed.current = true;
      onView(video);
    }
  }, [visible, onView, video]);
  const label = video.label ?? video.title;

  return (
    <button
      ref={ref}
      type="button"
      className={`story${seen ? ' seen' : ''}`}
      aria-label={`Open story: ${video.title}${video.liveId ? ', live' : ''}${seen ? ', seen' : ''}`}
      onClick={onOpen}
    >
      <span className="ring">
        {video.poster ? <img src={video.poster} alt="" loading="lazy" width="56" height="56" /> : <span className="fallback">{label.slice(0, 1)}</span>}
        {video.liveId && (
          <span className="story-live" aria-hidden="true">
            LIVE
          </span>
        )}
      </span>
      <span className="story-label" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}

/** Instagram-style row of round avatars. Opening one starts the same full-screen player as the carousel. */
export function Stories({
  videos,
  seen,
  onOpen,
  onView,
}: {
  videos: Video[];
  seen: ReadonlySet<string>;
  onOpen: (index: number) => void;
  onView: (v: Video) => void;
}) {
  return (
    <ul className="stories" aria-label="Stories">
      {videos.map((v, i) => (
        <li key={v.id}>
          <Avatar video={v} seen={seen.has(v.id)} onOpen={() => onOpen(i)} onView={onView} />
        </li>
      ))}
    </ul>
  );
}

/** Same height as the real row, so nothing jumps when the config arrives. */
export function StoriesSkeleton() {
  return (
    <div className="stories" aria-busy="true" aria-label="Loading stories">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="story">
          <span className="ring skeleton" />
        </div>
      ))}
    </div>
  );
}
