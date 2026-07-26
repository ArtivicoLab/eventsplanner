// Desktop sidebar (shown >=900px).
import { useEffect, useMemo, useState } from "react";
import { navigate, type Route } from "../router";
import { NAV, SETTINGS_ITEM, ROUTE_LABELS } from "../nav";
import { IconHeart, IconCompass, IconPauseCircle, IconPlayCircle } from "./icons";
import { useSync } from "../stores/useSync";
import { useDemo } from "../lib/demo";
import { useEvents } from "../stores/useEvents";
import { useEventTasks } from "../stores/useEventTasks";
import { useLiveFeed, type FeedItem } from "../stores/useLiveFeed";
import { openCoachTour } from "../stores/useCoachTour";
import { APP_VERSION, BUILD_SHA } from "../lib/config";

const STATUS_LABEL: Record<string, string> = {
  synced: "Synced",
  syncing: "Syncing…",
  offline: "Offline",
};

const NAV_COUNT: Partial<Record<Route, (n: { events: number; tasks: number }) => number>> = {
  events: (n) => n.events,
  tasks: (n) => n.tasks,
};

const FEED_WINDOW = 5;
const FEED_INTERVAL_MS = 5000;

function FeedLine({ item }: { item: FeedItem }) {
  return (
    <span className="sidebar__feedline">
      {item.live && <span className="sidebar__feeddot" aria-hidden />}
      <span className="sidebar__feedname" style={{ color: item.color }}>
        {item.name}
      </span>{" "}
      <span className="sidebar__feedmsg">{item.message}</span>
    </span>
  );
}

export function Sidebar({ active }: { active: Route }) {
  const { status, connected, needsReauth, busy, tapToRetry } = useSync();
  const demo = useDemo((s) => s.demo);
  const { items: events } = useEvents();
  const { items: tasks } = useEventTasks();
  const navCounts = { events: events.length, tasks: tasks.length };
  const feedPool = useLiveFeed();

  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (paused || feedPool.length <= FEED_WINDOW) return;
    const id = setInterval(() => setTick((t) => t + 1), FEED_INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, feedPool.length]);

  const visibleFeed = useMemo(() => {
    if (feedPool.length === 0) return [];
    const n = Math.min(FEED_WINDOW, feedPool.length);
    return Array.from({ length: n }, (_, i) => feedPool[(tick + i) % feedPool.length]);
  }, [feedPool, tick]);

  const retryable = connected && !needsReauth && status === "offline";
  const clickable = needsReauth || retryable;
  const dot =
    needsReauth || status === "offline" ? "var(--warn)"
    : status === "synced" ? "var(--success)" : "var(--accent)";

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="/favicon-96x96.png" alt="" aria-hidden width={26} height={26} className="sidebar__brandimg" />
        Event Planner
        {demo && <span className="brand-demo" data-tour="demo-badge">Demo</span>}
      </div>
      <div className="sidebar__scroll">
        <div className="sidebar__group">
          {NAV.map(({ route, label, Icon, color }) => {
            const count = NAV_COUNT[route]?.(navCounts);
            return (
              <button
                key={route}
                className={`sidebar__item${active === route ? " sidebar__item--on" : ""}`}
                data-tour={`nav-${route}`}
                onClick={() => navigate(route)}
              >
                <span className="sidebar__ico" style={{ background: color }}>
                  <Icon size={16} />
                </span>
                {label}
                {!!count && <span className="sidebar__badge">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="sidebar__group">
          <button
            className={`sidebar__item${active === "settings" ? " sidebar__item--on" : ""}`}
            data-tour="nav-settings"
            onClick={() => navigate("settings")}
          >
            <span className="sidebar__ico" style={{ background: "var(--surface-2)" }}>
              <SETTINGS_ITEM.Icon size={16} />
            </span>
            Settings
          </button>
          <button className="sidebar__item" onClick={openCoachTour}>
            <span className="sidebar__ico" style={{ background: "var(--surface-2)" }}>
              <IconCompass size={16} />
            </span>
            Coach Tour: {ROUTE_LABELS[active]}
          </button>
          <button
            className={`sidebar__item${active === "privacy" ? " sidebar__item--on" : ""}`}
            onClick={() => navigate("privacy")}
          >
            <span className="sidebar__ico" style={{ background: "var(--surface-2)" }}>
              <IconHeart size={16} />
            </span>
            Privacy
          </button>
        </div>

        {visibleFeed.length > 0 && (
          <div className="sidebar__group" data-tour="sidebar-live">
            <div className="sidebar__feedhead">
              <span>
                {!paused && <span className="sidebar__feeddot" aria-hidden />}
                Live
              </span>
              <button
                className="sidebar__feedpause"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Resume live feed" : "Pause live feed"}
                title={paused ? "Resume live feed" : "Pause live feed"}
              >
                {paused ? <IconPlayCircle size={15} /> : <IconPauseCircle size={15} />}
              </button>
            </div>
            {visibleFeed.map((item) =>
              item.onClick ? (
                <button key={item.key} className="sidebar__feedrow" onClick={item.onClick}>
                  <FeedLine item={item} />
                </button>
              ) : (
                <div key={item.key} className="sidebar__feedrow sidebar__feedrow--static">
                  <FeedLine item={item} />
                </div>
              )
            )}
          </div>
        )}
      </div>
      <div className="sidebar__foot">
        {!demo && (clickable ? (
          <button
            className="syncpill"
            disabled={busy}
            onClick={() => tapToRetry()}
            title={needsReauth ? "Your Google connection lapsed after being idle a while. Tap to sign in again, nothing was lost" : "Tap to retry syncing now"}
          >
            <span className="syncpill__dot" style={{ background: dot }} />
            {busy ? (needsReauth ? "Reconnecting…" : "Syncing…") : needsReauth ? "Tap to reconnect" : "Offline · tap to retry"}
          </button>
        ) : (
          <span className="syncpill">
            <span className="syncpill__dot" style={{ background: dot }} />
            {connected ? STATUS_LABEL[status] : "Saved on device"}
          </span>
        ))}
        <span className="sidebar__version">
          v{APP_VERSION}
          {BUILD_SHA && ` · ${BUILD_SHA}`}
        </span>
      </div>
    </aside>
  );
}
