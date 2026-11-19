import { type RefObject, useEffect, useState } from 'react';

/**
 * Segmented progress bars: one per story, filled for the ones already seen, filling for the current one.
 * Like HotspotLayer it keeps the playback time in its own state, so the player doesn't re-render on every timeupdate.
 */
export function StoryProgress({ count, index, videoRef }: { count: number; index: number; videoRef: RefObject<HTMLVideoElement | null> }) {
  const [fraction, setFraction] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const update = () => setFraction(v.duration > 0 ? Math.min(1, v.currentTime / v.duration) : 0);
    v.addEventListener('timeupdate', update);
    v.addEventListener('loadedmetadata', update);
    update();
    return () => {
      v.removeEventListener('timeupdate', update);
      v.removeEventListener('loadedmetadata', update);
    };
  }, [videoRef]);

  return (
    <div className="progress" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="seg">
          <span className="fill" style={{ width: `${(i < index ? 1 : i === index ? fraction : 0) * 100}%` }} />
        </span>
      ))}
    </div>
  );
}
