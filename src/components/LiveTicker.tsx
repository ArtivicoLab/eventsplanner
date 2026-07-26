// Mobile-only floating "live" feed — the same rotating list of rows the
// desktop Sidebar shows (name + short status, no background per row), just
// floating in the bottom-right corner instead of living inside a side
// panel: "on the right bottom corner going up just the same way as the left
// panel but just text without the panel showing on top of everything".
// Rows stack upward from a fixed close button anchored at the bottom, in
// front of every screen's content. CSS hides this entirely on desktop
// (>=900px), where the Sidebar's own feed already covers the job — see
// .liveticker in base.css.
import { useEffect, useMemo, useState } from "react";
import { useLiveFeed } from "../stores/useLiveFeed";
import { IconClose } from "./icons";

const FEED_WINDOW = 4;
const FEED_INTERVAL_MS = 5000;

export function LiveTicker() {
  const feedPool = useLiveFeed();
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (feedPool.length <= FEED_WINDOW) return;
    const id = setInterval(() => setTick((t) => t + 1), FEED_INTERVAL_MS);
    return () => clearInterval(id);
  }, [feedPool.length]);

  const visible = useMemo(() => {
    if (feedPool.length === 0) return [];
    const n = Math.min(FEED_WINDOW, feedPool.length);
    return Array.from({ length: n }, (_, i) => feedPool[(tick + i) % feedPool.length]);
  }, [feedPool, tick]);

  if (dismissed || visible.length === 0) return null;

  return (
    <div className="liveticker" data-tour="live-ticker">
      <button
        className="liveticker__close"
        onClick={() => setDismissed(true)}
        aria-label="Turn off live updates"
        title="Turn off live updates"
      >
        <IconClose size={12} />
      </button>
      {visible.map((item) => (
        <span key={item.key} className="liveticker__item">
          {item.live && <span className="liveticker__livedot" aria-hidden />}
          <span className="liveticker__name" style={{ color: item.color }}>{item.name}</span>
          <span className="liveticker__msg">{item.message}</span>
        </span>
      ))}
    </div>
  );
}
