import { useEffect, useRef, useState } from 'react';
import type { Video } from '../types';
import { useInView } from './useInView';

function VideoCard({ video, onOpen, onView }: { video: Video; onOpen: (v: Video) => void; onView: (v: Video) => void }) {
  const card = useRef<HTMLButtonElement>(null);
  const el = useRef<HTMLVideoElement>(null);
  // Two thresholds: start downloading a bit before the card is visible, play only when mostly visible.
  const nearby = useInView(card, 0, '0px 300px');
  const playing = useInView(card, 0.6);
  const [loaded, setLoaded] = useState(false);
  const seen = useRef(false);

  // One impression per video per page load, counted when it is actually playing in view.
  useEffect(() => {
    if (playing && !seen.current) {
      seen.current = true;
      onView(video);
    }
  }, [playing, onView, video]);

  useEffect(() => {
    if (nearby) setLoaded(true);
  }, [nearby]);

  useEffect(() => {
    const v = el.current;
    if (!v || !loaded) return;
    if (playing) v.play()?.catch(() => {}); // autoplay can be refused; the poster-less card stays usable
    else v.pause();
  }, [playing, loaded]);

  return (
    <button ref={card} type="button" className="card" aria-label={`Watch: ${video.title}`} onClick={() => onOpen(video)}>
      <video ref={el} src={loaded ? video.src : undefined} muted loop playsInline preload="metadata" />
      <span className="label">{video.title}</span>
    </button>
  );
}

export function Carousel({ videos, onOpen, onView }: { videos: Video[]; onOpen: (v: Video) => void; onView: (v: Video) => void }) {
  return (
    <ul className="strip" aria-label="Shop the videos">
      {videos.map((v) => (
        <li key={v.id}>
          <VideoCard video={v} onOpen={onOpen} onView={onView} />
        </li>
      ))}
    </ul>
  );
}

/** Same height as the real strip so nothing jumps when config arrives. */
export function CarouselSkeleton() {
  return (
    <div className="strip" aria-busy="true" aria-label="Loading videos">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" />
      ))}
    </div>
  );
}
