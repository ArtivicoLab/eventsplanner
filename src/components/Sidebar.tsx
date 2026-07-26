// Desktop sidebar (shown >=900px).
import { useEffect, useMemo, useState } from "react";
import { navigate, type Route } from "../router";
import { NAV, SETTINGS_ITEM, ROUTE_LABELS } from "../nav";
import { IconHeart, IconCompass, IconPauseCircle, IconPlayCircle } from "./icons";
import { useSync } from "../stores/useSync";
import { useDemo } from "../lib/demo";
import { useEvents } from "../stores/useEvents";
import { useEventTasks } from "../stores/useEventTasks";
import { useGuests } from "../stores/useGuests";
import { useSettings } from "../stores/useSettings";
import { openCoachTour } from "../stores/useCoachTour";
import { APP_VERSION, BUILD_SHA } from "../lib/config";
import { daysBetween, formatTimeOfDay, fromISO, format, todayISO } from "../lib/dates";
import { categoryColor, money } from "../lib/ui";
import type { EventItem } from "../lib/types";

const STATUS_LABEL: Record<string, string> = {
  synced: "Synced",
  syncing: "Syncing…",
  offline: "Offline",
};

const NAV_COUNT: Partial<Record<Route, (n: { events: number; tasks: number }) => number>> = {
  events: (n) => n.events,
  tasks: (n) => n.tasks,
};

const MAX_FEED_EVENTS = 8;
const MAX_FEED_GUESTS = 6;
const FEED_WINDOW = 5;
const FEED_INTERVAL_MS = 5000;

interface FeedItem {
  key: string;
  name: string;
  color: string;
  message: string;
  live?: boolean;
  onClick?: () => void;
}

// Short, chat-message-style status text ("starts tomorrow", "is live now")
// for an upcoming event.
function feedMessage(e: EventItem, today: string): string {
  if (e.startDate <= today && today <= e.endDate) return "is live now";
  const diff = daysBetween(today, e.startDate);
  if (diff === 1) return "starts tomorrow";
  if (diff < 7) return `starts in ${diff}d`;
  return `starts ${format(fromISO(e.startDate), "MMM d")}`;
}

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
  const { items: guests } = useGuests();
  const settings = useSettings();
  const navCounts = { events: events.length, tasks: tasks.length };
  const today = todayISO();

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.startDate && e.endDate && e.endDate >= today)
        .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
        .slice(0, MAX_FEED_EVENTS),
    [events, today]
  );

  // Guests with an arrival time set, for whichever events are still
  // upcoming — a guest on an event that's already wrapped up isn't
  // "arriving" anywhere anymore.
  const upcomingArrivals = useMemo(() => {
    const upcomingIds = new Set(upcoming.map((e) => e.id));
    const eventById = new Map(upcoming.map((e) => [e.id, e]));
    return guests
      .filter((g) => g.arrivalTime && upcomingIds.has(g.eventId))
      .sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime))
      .slice(0, MAX_FEED_GUESTS)
      .map((g) => ({ guest: g, event: eventById.get(g.eventId)! }));
  }, [guests, upcoming]);

  const openTasks = tasks.filter((t) => t.status !== "Complete" && t.status !== "Cancelled").length;
  const totalBudget = events.reduce((a, e) => a + (e.budget || 0), 0);
  const syncMessage = demo
    ? "you're viewing sample data, nothing here is saved"
    : !connected
      ? "your data's safe on this device, connect anytime in Settings"
      : needsReauth
        ? "reconnect when you get a chance, nothing was lost"
        : status === "synced"
          ? "everything's backed up to your Google Sheet"
          : "syncing to your Google Sheet now";

  // A rotating mix of upcoming events, guest arrivals, and plain facts
  // about your own setup (sync, categories, open tasks, total budget),
  // styled like a livestream chat scrollback ("chats on Kick" was the
  // actual ask). Category pastels are fills, not text colors, on their
  // own, so each event's (and its guests') name is blended toward --ink
  // here rather than used raw: a pale pastel used straight as text
  // (confirmed live: orange text on an orange-tinted background) reads as
  // almost invisible regardless of theme.
  const feedPool = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = upcoming.map((e) => ({
      key: `ev-${e.id}`,
      name: e.name || "Untitled event",
      color: `color-mix(in srgb, ${categoryColor(e.category)}, var(--ink))`,
      message: feedMessage(e, today),
      live: e.startDate <= today,
      onClick: () => navigate("eventdetail", { id: e.id }),
    }));
    items.push(
      ...upcomingArrivals.map(({ guest: g, event: e }) => ({
        key: `guest-${g.id}`,
        name: g.name || "Unnamed guest",
        color: `color-mix(in srgb, ${categoryColor(e.category)}, var(--ink))`,
        message: `arriving ${formatTimeOfDay(g.arrivalTime)} for ${e.name || "Untitled event"}`,
        onClick: () => navigate("seating", { id: e.id }),
      }))
    );
    items.push(
      { key: "sys-sync", name: "Sync", color: "var(--success)", message: syncMessage },
      {
        key: "sys-settings",
        name: "Settings",
        color: "var(--accent-2)",
        message: `${settings.categories.length} categories, ${settings.eventStatuses.length} statuses set up`,
      },
      {
        key: "sys-tasks",
        name: "Tasks",
        color: "var(--warn)",
        message: openTasks > 0 ? `${openTasks} task${openTasks === 1 ? "" : "s"} still need doing` : "everything's done, nice work",
      },
      {
        key: "sys-budget",
        name: "Budget",
        color: "var(--accent)",
        message: `tracking ${money(totalBudget, settings.currency)} across all events`,
      }
    );
    return items;
  }, [upcoming, upcomingArrivals, today, syncMessage, settings.categories.length, settings.eventStatuses.length, openTasks, totalBudget, settings.currency]);

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
