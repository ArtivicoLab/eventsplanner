// Home screen — a data-rich overview modeled on the reference product's
// "All-in-one Dashboard": a compact read-only month calendar, several small
// charts, and two "what's coming up" lists. All charts route through
// components/Charts.tsx (CSS/JS only, no SVG, no chart library).
import type { CSSProperties } from "react";
import type { EventItem } from "../../lib/types";
import { PRIORITIES, TASK_STATUSES } from "../../lib/types";
import { useEvents } from "../../stores/useEvents";
import { useEventTasks } from "../../stores/useEventTasks";
import { useExpenses } from "../../stores/useExpenses";
import { useSettings } from "../../stores/useSettings";
import { EmptyState } from "../../components/EmptyState";
import { CountUp } from "../../components/CountUp";
import { Donut, StatusBar, Bars, GroupedBars } from "../../components/Charts";
import {
  todayISO,
  addDaysISO,
  monthGridISO,
  monthTitle,
  weekdayShort,
  dayNum,
  inSameMonth,
  isTodayISO,
  rangesOverlap,
  dueLabel,
  daysBetween,
  fromISO,
  format,
} from "../../lib/dates";
import {
  categoryColor,
  eventStatusColor,
  money,
  PRIORITY_LABEL,
  PRIORITY_COLOR,
  TASK_STATUS_LABEL,
  TASK_STATUS_COLOR,
} from "../../lib/ui";
import { navigate } from "../../router";
import { IconEvents, IconTasks } from "../../components/icons";
import { PageTourButton } from "../../components/PageTourButton";

function dateRangeLabel(e: EventItem): string {
  const start = format(fromISO(e.startDate), "MMM d");
  if (e.endDate && e.endDate !== e.startDate) {
    return `${start} – ${format(fromISO(e.endDate), "MMM d")}`;
  }
  return start;
}

function StatTile({
  label,
  value,
  fmt,
}: {
  label: string;
  value: number;
  fmt?: (n: number) => string;
}) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className="v">
        <CountUp value={value} format={fmt} />
      </div>
    </div>
  );
}

// Soft floating dots in the hero background: plain circles, deliberately
// not hearts (owner call, 2026-07-24). Position/size/timing mirrors the
// reference mockup's own decorative layer.
function HeroArt() {
  const dots: Array<{ top: string; right: string; size: number; color: string; delay: string }> = [
    { top: "18%", right: "8%", size: 11, color: "var(--accent)", delay: "0s" },
    { top: "52%", right: "16%", size: 7, color: "var(--accent-2)", delay: "1.4s" },
    { top: "26%", right: "26%", size: 8, color: "var(--cat-clay)", delay: "2.8s" },
    { top: "60%", right: "4%", size: 6, color: "var(--accent)", delay: "4s" },
    { top: "38%", right: "37%", size: 5, color: "var(--accent-2)", delay: "2s" },
  ];
  return (
    <div className="hero-art" aria-hidden>
      {dots.map((d, i) => (
        <span
          key={i}
          style={
            {
              top: d.top,
              right: d.right,
              "--s": `${d.size}px`,
              "--c": d.color,
              animationDelay: d.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function DashboardScreen() {
  const { items: events } = useEvents();
  const { items: tasks } = useEventTasks();
  const { items: expenses } = useExpenses();
  const { name, currency, weekStart } = useSettings();

  const today = todayISO();

  if (events.length === 0) {
    return (
      <>
        <div className="hero">
          <HeroArt />
          <div className="hero-body">
            <div className="hero-top">
              <div>
                <h1 className="page-title">Dashboard</h1>
                <p className="page-sub" style={{ marginBottom: 0 }}>
                  {name ? `Welcome, ${name}. Let's get your first event on the books.` : "Here's what's ahead, once you add an event."}
                </p>
              </div>
              <PageTourButton />
            </div>
          </div>
        </div>
        <EmptyState
          icon={<IconEvents size={28} />}
          title="No events yet"
          sub="Add your first event to see your dashboard come alive with a calendar, charts, and what's coming up."
        >
          <button
            className="btn btn--primary"
            style={{ maxWidth: 280, margin: "0 auto" }}
            onClick={() => navigate("events")}
          >
            Add your first event
          </button>
        </EmptyState>
      </>
    );
  }

  // ---- stat tiles ----
  const in30 = addDaysISO(today, 30);
  const eventsNext30 = events.filter((e) => e.startDate >= today && e.startDate <= in30).length;
  const totalBudget = events.reduce((a, e) => a + (e.budget || 0), 0);
  const totalSpent = expenses.reduce((a, x) => a + (x.amount || 0), 0);

  // ---- month calendar ----
  const grid = monthGridISO(today, weekStart);
  const weekdayHeaders = grid.slice(0, 7).map(weekdayShort);
  const firstEventForDay = (iso: string): EventItem | undefined =>
    events.find((e) => rangesOverlap(iso, iso, e.startDate, e.endDate || e.startDate));

  // ---- category / priority / status / type breakdowns ----
  const categoryCounts = new Map<string, number>();
  events.forEach((e) => {
    const key = e.category || "Uncategorized";
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  });
  const categorySlices = Array.from(categoryCounts, ([label, value]) => ({
    label,
    value,
    color: categoryColor(label),
  }));

  const priorityData = PRIORITIES.map((p) => ({
    label: PRIORITY_LABEL[p],
    value: events.filter((e) => e.priority === p).length,
    color: PRIORITY_COLOR[p],
  }));

  const statusCounts = new Map<string, number>();
  events.forEach((e) => {
    const key = e.status || "Unspecified";
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
  });
  const statusSegments = Array.from(statusCounts, ([label, value]) => ({
    label,
    value,
    color: eventStatusColor(label),
  }));

  const typeCounts = new Map<string, number>();
  events.forEach((e) => {
    const key = e.type || "Unspecified";
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
  });
  const typeData = Array.from(typeCounts, ([label, value]) => ({ label, value }));

  const taskStatusData = TASK_STATUSES.map((s) => ({
    label: TASK_STATUS_LABEL[s],
    value: tasks.filter((t) => t.status === s).length,
    color: TASK_STATUS_COLOR[s],
  }));

  // ---- budget vs actual, capped at the 6 largest by budget ----
  const budgetRows = events
    .map((e) => ({
      label: e.name || "Untitled event",
      budget: e.budget || 0,
      actual: expenses.filter((x) => x.eventId === e.id).reduce((a, x) => a + x.amount, 0),
    }))
    .sort((a, b) => b.budget - a.budget);
  const budgetShown = budgetRows.slice(0, 6);
  const budgetMore = budgetRows.length - budgetShown.length;

  // ---- upcoming lists ----
  const upcomingEvents = events
    .filter((e) => e.startDate >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
    .slice(0, 6);

  const upcomingTasks = tasks
    .filter((t) => t.dueDate && t.dueDate >= today && t.status !== "Complete" && t.status !== "Cancelled")
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
    .slice(0, 6);
  const eventNameFor = (id: string): string => events.find((e) => e.id === id)?.name || "Untitled event";

  return (
    <>
      <div className="hero">
        <HeroArt />
        <div className="hero-body">
          <div className="hero-top">
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-sub" style={{ marginBottom: 0 }}>
                {name ? `Welcome back, ${name}. Here's what's ahead.` : "Here's what's ahead across your events."}
              </p>
            </div>
            <PageTourButton />
          </div>
          <div className="stat-row" data-tour="dash-stats">
            <StatTile label="Total events" value={events.length} />
            <StatTile label="Next 30 days" value={eventsNext30} />
            <StatTile label="Total budget" value={totalBudget} fmt={(n) => money(n, currency)} />
            <StatTile label="Total spent" value={totalSpent} fmt={(n) => money(n, currency)} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <div className="card" data-tour="dash-calendar">
        <div className="spread mb-1">
          <div className="section-title" style={{ marginBottom: 0 }}>
            {monthTitle(today)}
          </div>
          <button
            className="btn btn--ghost btn--auto"
            style={{ padding: "6px 14px", fontSize: 12.5 }}
            onClick={() => navigate("calendar")}
          >
            View calendar
          </button>
        </div>
        <div className="love-divider" />
        <div className="calgrid">
          {weekdayHeaders.map((wd, i) => (
            <div key={`wd-${i}`} className="calgrid__weekday">
              {wd}
            </div>
          ))}
          {grid.map((iso) => {
            const inMonth = inSameMonth(iso, today);
            const isToday = isTodayISO(iso, today);
            const dayEvent = firstEventForDay(iso);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => navigate("calendar", { date: iso })}
                aria-label={`${format(fromISO(iso), "MMMM d")}${dayEvent ? `, ${dayEvent.name}` : ""}`}
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  border: "none",
                  borderRadius: 10,
                  background: isToday
                    ? "linear-gradient(135deg, var(--accent), var(--accent-2))"
                    : "var(--surface-2)",
                  color: isToday ? "#fff" : inMonth ? "var(--ink)" : "var(--muted)",
                  opacity: inMonth ? 1 : 0.5,
                  fontWeight: isToday ? 800 : 600,
                  fontSize: 12.5,
                  padding: 2,
                }}
              >
                <span>{dayNum(iso)}</span>
                {dayEvent && (
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flex: "none",
                      background: categoryColor(dayEvent.category),
                      // A pale category color (the marigold/butter end of the
                      // palette especially) all but disappears against the
                      // similarly light cream cell background with no outline.
                      // A dark ring keeps every dot visible regardless of
                      // which color it happens to be.
                      boxShadow: "0 0 0 1.5px color-mix(in srgb, var(--ink) 45%, transparent)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid-dash">
        <div className="card">
          <div className="section-title">Event category</div>
          <Donut slices={categorySlices} />
        </div>

        <div className="card">
          <div className="section-title">Event priority</div>
          <Bars data={priorityData} />
        </div>

        <div className="card">
          <div className="section-title">Event status</div>
          <StatusBar segments={statusSegments} />
        </div>

        <div className="card">
          <div className="section-title">Event type</div>
          <Bars data={typeData} />
        </div>

        <div className="card">
          <div className="section-title">Task status</div>
          {tasks.length === 0 ? (
            <div className="muted fs-13">No tasks yet.</div>
          ) : (
            <Donut slices={taskStatusData} />
          )}
        </div>

        <div className="card">
          <div className="section-title">Budget vs actual</div>
          <GroupedBars data={budgetShown} />
          {budgetMore > 0 && <div className="muted fs-13" style={{ marginTop: "var(--sp-2)" }}>+{budgetMore} more events</div>}
        </div>

        <div className="card" data-tour="dash-upcoming">
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconEvents size={15} />
            Upcoming events
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="muted fs-13">Nothing scheduled yet.</div>
          ) : (
            <div className="list">
              {upcomingEvents.map((e) => (
                <button key={e.id} className="list__row" onClick={() => navigate("eventdetail", { id: e.id })}>
                  <span className="datechip">
                    <span className="datechip__m">{format(fromISO(e.startDate), "MMM")}</span>
                    <span className="datechip__d">{dayNum(e.startDate)}</span>
                  </span>
                  <span className="list__body">
                    <span className="list__title">{e.name || "Untitled event"}</span>
                    <span className="list__sub">{dateRangeLabel(e)}</span>
                  </span>
                  <span
                    className="pill"
                    style={{
                      color: eventStatusColor(e.status),
                      background: `color-mix(in srgb, ${eventStatusColor(e.status)} 18%, var(--surface))`,
                    }}
                  >
                    {e.status || "No status"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card" data-tour="dash-tasks">
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconTasks size={15} />
            Upcoming tasks
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="muted fs-13">Nothing due yet.</div>
          ) : (
            <div className="list">
              {upcomingTasks.map((t) => {
                const hot = t.dueDate ? daysBetween(today, t.dueDate) <= 1 : false;
                return (
                  <button key={t.id} className="list__row" onClick={() => navigate("eventdetail", { id: t.eventId })}>
                    <span className="ring" style={{ borderColor: PRIORITY_COLOR[t.priority] }} />
                    <span className="list__body">
                      <span className="list__title">{t.task || "Untitled task"}</span>
                      <span className="list__sub">{eventNameFor(t.eventId)}</span>
                    </span>
                    <span className={`duelabel${hot ? " duelabel--hot" : ""}`}>{dueLabel(t.dueDate)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
