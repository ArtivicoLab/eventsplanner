// A rotating, priority-ordered mix of events (and their guests), upcoming
// events, and plain facts about your own setup (sync, categories, open
// tasks, total budget), styled like a livestream chat scrollback ("chats on
// Kick" was the actual ask). Priority, highest first: a live event and its
// guests' arrivals (if any) > merely-upcoming events > everything else.
// Shared by the desktop Sidebar's rotating feed and the mobile LiveTicker's
// floating one, so both read from exactly the same pool instead of two
// versions of this logic drifting apart.
import { useMemo } from "react";
import { useEvents } from "./useEvents";
import { useEventTasks } from "./useEventTasks";
import { useGuests } from "./useGuests";
import { useSettings } from "./useSettings";
import { useSync } from "./useSync";
import { useDemo } from "../lib/demo";
import { navigate } from "../router";
import { daysBetween, formatTimeOfDay, fromISO, format, todayISO } from "../lib/dates";
import { categoryColor, money } from "../lib/ui";
import type { EventItem } from "../lib/types";

const MAX_FEED_EVENTS = 8;
const MAX_FEED_GUESTS = 6;

export interface FeedItem {
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

export function useLiveFeed(): FeedItem[] {
  const { status, connected, needsReauth } = useSync();
  const demo = useDemo((s) => s.demo);
  const { items: events } = useEvents();
  const { items: tasks } = useEventTasks();
  const { items: guests } = useGuests();
  const settings = useSettings();
  const today = todayISO();

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.startDate && e.endDate && e.endDate >= today)
        .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
        .slice(0, MAX_FEED_EVENTS),
    [events, today]
  );

  // Guests only surface once their own event is actually live — an arrival
  // time is a same-day detail, not something worth alerting on for an event
  // that's still days out — and they're grouped right after that event
  // rather than bunched at the end, so "the event and its guests, if any"
  // is the single most important thing this feed can say, ranked above
  // merely-upcoming events and well above the system facts at the bottom.
  // Already-`arrived` guests are excluded: this feed is an "arriving soon"
  // notice, not an attendance log, so once someone's checked in (at the
  // door, marked by hand on Guests/Seating) there's nothing left to
  // announce and they stop taking up one of the MAX_FEED_GUESTS slots.
  const liveGuestsByEvent = useMemo(() => {
    const liveIds = new Set(upcoming.filter((e) => e.startDate <= today).map((e) => e.id));
    const sorted = guests
      .filter((g) => g.arrivalTime && !g.arrived && liveIds.has(g.eventId))
      .sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime))
      .slice(0, MAX_FEED_GUESTS);
    const m = new Map<string, typeof sorted>();
    for (const g of sorted) {
      if (!m.has(g.eventId)) m.set(g.eventId, []);
      m.get(g.eventId)!.push(g);
    }
    return m;
  }, [guests, upcoming, today]);

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

  // Category pastels are fills, not text colors, on their own, so each
  // event's (and its guests') name is blended toward --ink here rather than
  // used raw: a pale pastel used straight as text (confirmed live: orange
  // text on an orange-tinted background) reads as almost invisible
  // regardless of theme.
  return useMemo<FeedItem[]>(() => {
    // `upcoming` is already sorted by startDate ascending, which — since a
    // live event's startDate is always <= today and a not-yet-live event's
    // is always > today — already ranks every live event before every
    // merely-upcoming one. The one thing that sort doesn't do on its own is
    // keep a live event's guests right next to it instead of tacked on at
    // the very end, which is what the loop below fixes.
    const items: FeedItem[] = [];
    for (const e of upcoming) {
      const color = `color-mix(in srgb, ${categoryColor(e.category)}, var(--ink))`;
      items.push({
        key: `ev-${e.id}`,
        name: e.name || "Untitled event",
        color,
        message: feedMessage(e, today),
        live: e.startDate <= today,
        onClick: () => navigate("eventdetail", { id: e.id }),
      });
      for (const g of liveGuestsByEvent.get(e.id) ?? []) {
        items.push({
          key: `guest-${g.id}`,
          name: g.name || "Unnamed guest",
          color,
          message: `arriving ${formatTimeOfDay(g.arrivalTime)} for ${e.name || "Untitled event"}`,
          onClick: () => navigate("seating", { id: e.id }),
        });
      }
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming, liveGuestsByEvent, today, syncMessage, settings.categories.length, settings.eventStatuses.length, openTasks, totalBudget, settings.currency]);
}
