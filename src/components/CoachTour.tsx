// Coach-mark tour. Each screen has its own short coach, scoped to only what's
// actually rendered there right now — no cross-screen auto-navigation. A step
// spotlights a real, existing element via a `data-tour="<key>"` attribute (see
// Sidebar/TabBar/Header and the various screens). Steps whose target isn't
// currently in the DOM (e.g. a chart that only shows once there's data) are
// filtered out before the tour ever opens, so a page with nothing relevant to
// show just doesn't open one — this is what lets a real, empty account (no
// events yet) use the tour safely with no sample-data juggling: demo mode
// already shows sample events for a brand-new visitor, and an activated real
// user with genuinely no data just sees fewer steps.
// "Seen forever" (for the one automatic first-run showing, on the Dashboard)
// persists in plain localStorage — a UI preference, not user data.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type CSSProperties } from "react";
import { useRoute, type Route } from "../router";

const TOUR_SEEN_KEY = "ep.tourSeen";

// Appended to the first step of every page's OWN tour (not Dashboard's,
// which already opens with a longer version of the same idea) so someone
// who starts touring on Calendar, Events, Seating, Tasks, Budget, or
// Settings still learns that every other page has its own tour too, not
// just the one they happen to be looking at.
const EVERY_PAGE_REMINDER =
  " Every page has a short tour like this one. Look for the compass icon, or the Take the tour button, to reopen it any time.";

interface TourStep {
  target: string; // matches a `data-tour` attribute value
  route?: Route; // screen this target lives on — omit for "dashboard"
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  // ---------- Dashboard: welcome + a lap around every tab ----------
  {
    target: "nav-dashboard",
    title: "Welcome to Event Planner",
    body: "This quick tour explains what is on the screen in front of you. Every page has its own short tour like this one. Look for the compass icon, or the Take the tour button, on any page to open it again.",
  },
  {
    target: "nav-calendar",
    title: "Calendar",
    body: "A multi-day event renders as one continuous bar across the days it runs, stacked so overlapping events never collide. It's the fastest way to see everything at a glance.",
  },
  {
    target: "nav-events",
    title: "Events",
    body: "Every event you're planning lives here. Search or filter the list, then tap into any event for its full details, tasks, expenses, and seating chart.",
  },
  {
    target: "nav-seating",
    title: "Seating",
    body: "Plan tables and place guests for any event. Pick a ready made layout to place a whole floor plan at once, or add rooms one at a time.",
  },
  {
    target: "nav-guests",
    title: "Guests",
    body: "Your whole guest list, across every event, in one place. Set when each guest arrives, and those arrivals show up in the Live feed.",
  },
  {
    target: "nav-tasks",
    title: "Tasks",
    body: "Every to do item across every event, gathered into one list. Filter by status, priority, or a single event to see just what needs attention.",
  },
  {
    target: "nav-budget",
    title: "Budget",
    body: "Budget versus what you've actually spent, across every event, plus a full expense log. See exactly where a plan and reality diverge.",
  },
  {
    target: "demo-badge",
    title: "The Demo badge",
    body: "This badge means you're looking at sample events, not your own. Nothing you do while it's showing gets saved. Tap \"Use my own data\" on the banner near the top of the screen to switch to your real, blank planner. You can always come back to sample data later from Settings.",
  },
  {
    target: "sidebar-live",
    title: "Live, right in the sidebar",
    body:
      "A rotating feed of what's coming up, mixed with quick facts about your own setup: sync status," +
      " how many categories you've got, open tasks, total budget. It cycles on its own every few" +
      " seconds. Tap the pause icon next to \"Live\" any time to freeze it exactly where it is.",
  },
  {
    target: "dash-stats",
    title: "Your event stats, up top",
    body: "Total events, what's coming in the next 30 days, and how your budget compares to what's actually been spent.",
  },
  {
    target: "dash-calendar",
    title: "This month, at a glance",
    body: "A dot marks any day with an event. Tap a day, or \"View calendar\", to open the full calendar.",
  },
  {
    target: "dash-upcoming",
    title: "What's coming up",
    body: "Your next events, soonest first. Tap one to jump straight into it.",
  },
  {
    target: "dash-tasks",
    title: "What needs doing",
    body: "Tasks due soonest across every event, so you don't have to check each one separately. Tap a task to open the event it belongs to.",
  },
  {
    target: "nav-settings",
    title: "Make it yours",
    body: "Categories, event types, statuses, owners: everything in Settings → Quick Setup is yours to rename, recolor, and reorder.",
  },
  // ---------- Calendar ----------
  // Ordered "how to read it" before "how to act on it": a first-time visitor
  // lands on a grid full of colored bars with no idea what they mean yet, so
  // the grid/legend explanation has to come before Filters/Add or neither of
  // those will make sense either.
  {
    target: "cal-grid",
    route: "calendar",
    title: "Multi-day events, done right",
    body:
      "This is not a typical calendar grid. Each colored bar spans every day its event covers, so a" +
      " 3-day event is one bar 3 cells wide, not 3 separate marks. Tap any bar to open that event's" +
      " full detail page. Today's cell is highlighted so you always know where you are." +
      EVERY_PAGE_REMINDER,
  },
  {
    target: "cal-legend",
    route: "calendar",
    title: "Bar color means category",
    body:
      "Every bar is colored by its event's category, listed here. If a day has more events than fit" +
      " (you'll see a small \"+N\"), open Events to see the full list for that day.",
  },
  {
    target: "cal-filters",
    route: "calendar",
    title: "Filter what you see",
    body: "Tap a category to hide it from the grid, or hide anything already complete or cancelled.",
  },
  {
    target: "cal-add",
    route: "calendar",
    title: "Add an event",
    body: "Add an event right from here, no need to leave the calendar.",
  },
  // ---------- Events ----------
  {
    target: "events-search",
    route: "events",
    title: "Find any event fast",
    body: "Search by name, or filter by category, status, type, and priority." + EVERY_PAGE_REMINDER,
  },
  {
    target: "events-add",
    route: "events",
    title: "Add an event",
    body: "Name, dates, location, budget, priority, status: everything about an event starts here.",
  },
  {
    target: "events-now",
    route: "events",
    title: "Happening right now",
    body: "Whenever today falls inside an event's dates, it gets called out here so you never miss that it's live. Tap \"View event\" to jump straight to it.",
  },
  {
    target: "events-list",
    route: "events",
    title: "Tap in for the full picture",
    body: "Tap an event to open its tasks, expenses, and seating chart, all in one place. Tap the pencil to edit it quickly without leaving the list.",
  },
  // ---------- Seating ----------
  {
    target: "seating-event",
    route: "seating",
    title: "One event at a time",
    body: "Seating is its own page, not tucked inside an event. Pick which event's floor plan you're working on here, and switch any time." + EVERY_PAGE_REMINDER,
  },
  {
    target: "seating-layout",
    route: "seating",
    title: "Choose a ready made layout",
    body: "Pick an arrangement (banquet, classroom, U shape, head table and rounds), set how many tables and seats per table, and the whole floor plan is placed for you in one go. Every table stays draggable afterward.",
  },
  {
    target: "seating-canvas",
    route: "seating",
    title: "Drag tables, tap seats",
    body: "Drag a table anywhere on the floor plan. Tap an empty seat to place a guest there, or tap a filled seat to view or move that guest. Each guest shows as a number, not a name, so the plan stays easy to read at a glance.",
  },
  {
    target: "seating-guests",
    route: "seating",
    title: "Guest Key",
    body: "Every guest's number is listed here with their name and where they're seated. Anyone not yet placed shows a Seat button to place them from this list instead of hunting for an empty seat.",
  },
  // ---------- Guests ----------
  {
    target: "guests-add",
    route: "guests",
    title: "One guest list, every event",
    body:
      "This is your whole guest list in one place. Add a guest, pick which event they belong to, and" +
      " set when they arrive." +
      EVERY_PAGE_REMINDER,
  },
  {
    target: "guests-list",
    route: "guests",
    title: "Grouped by event, sorted by arrival",
    body:
      "Guests are grouped under their event and ordered by arrival time, so each event reads like a" +
      " timeline of who shows up when. Tap a guest to edit them. \"Open seating\" jumps to that event's" +
      " floor plan to place them.",
  },
  {
    target: "guests-filter",
    route: "guests",
    title: "Focus on one event",
    body: "Filter down to a single event's guests when you're working one wedding or party at a time.",
  },
  // ---------- Tasks ----------
  // Ordered the same way Calendar's tour is: what you're looking at first
  // (the triage grouping, the biggest thing this page actually does), then
  // the quick-count strip, then how to narrow it down, then how to add.
  // The list itself gets 3 slides, not 1: there's a lot happening in a
  // single task row (grouping, ring, tag, badge) and cramming it into one
  // dense paragraph wasn't actually explaining any of it well.
  {
    target: "tasks-list",
    route: "tasks",
    title: "Triaged for you",
    body:
      "Tasks sort themselves into three groups: Needs attention (overdue), Coming up (due within" +
      " a week), and Scheduled (everything further out). Tasks that are already Complete or" +
      " Cancelled stay out of all three, they don't need triaging anymore." +
      EVERY_PAGE_REMINDER,
  },
  {
    target: "tasks-list",
    route: "tasks",
    title: "Read a task at a glance",
    body:
      "The ring on the left is colored by priority. The pill next to the task's status and" +
      " priority is its event, tap it to jump straight there without opening the task itself." +
      " An assignee's initials show on the right on wider screens.",
  },
  {
    target: "tasks-list",
    route: "tasks",
    title: "Due badges tell the story",
    body:
      "Solid red means overdue. Warm means due tomorrow. Cool means due soon. Plain means it's" +
      " further out, or has no due date at all. Tap any task to edit it.",
  },
  {
    target: "tasks-triage",
    route: "tasks",
    title: "The whole picture, at a glance",
    body: "A quick count of what needs attention right now, what's due tomorrow, and how many active tasks you have in total.",
  },
  {
    target: "tasks-filters",
    route: "tasks",
    title: "Slice by status, priority, or event",
    body:
      "Filter this list down to exactly what you're looking for. Filtering to Complete or" +
      " Cancelled switches to a plain list, since triaging by urgency doesn't apply to tasks" +
      " that are already done.",
  },
  {
    target: "tasks-add",
    route: "tasks",
    title: "Add a task",
    body: "Tasks belong to an event. Add one here, or from that event's own page.",
  },
  // ---------- Budget ----------
  {
    target: "budget-stats",
    route: "budget",
    title: "The big picture",
    body: "Total budget, total spent, and what's left, added up across every event." + EVERY_PAGE_REMINDER,
  },
  {
    target: "budget-chart",
    route: "budget",
    title: "Budget vs. actual, per event",
    body: "See exactly where a plan and reality diverge, event by event.",
  },
  {
    target: "budget-add",
    route: "budget",
    title: "Log an expense",
    body: "Every expense belongs to an event. Log one here, or from that event's own page, and the totals above update instantly.",
  },
  // ---------- Settings ----------
  {
    target: "settings-demo",
    route: "settings",
    title: "Preview sample events any time",
    body:
      "Switch to sample data here to see a fully populated planner. Switch back to your own data whenever you like, nothing is lost or changed either way." +
      EVERY_PAGE_REMINDER,
  },
  {
    target: "settings-setup",
    route: "settings",
    title: "Quick Setup",
    body: "Categories, types, statuses, states, owners: every picklist used across the app lives here. Add, rename, recolor, or remove any of them.",
  },
  {
    target: "settings-sheets",
    route: "settings",
    title: "It's your data, in your Google Sheet",
    body: "Connect your own Google Sheet and it becomes the backup and single source of truth for every event, task, expense, and seating chart, synced automatically after that.",
  },
  {
    target: "settings-danger",
    route: "settings",
    title: "A safe Danger Zone",
    body: "Genuinely destructive actions are locked behind two latches you have to tap open first, so a stray tap never erases anything by accident.",
  },
];

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked (private mode etc.) — don't force the tour
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // ignore — worst case the tour reappears next visit
  }
}

function targetExists(key: string): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)).some(
    (el) => el.getClientRects().length > 0
  );
}

const CARD_GAP = 16;

export function CoachTour({ onDone }: { onDone: () => void }) {
  const currentRoute = useRoute();
  const [openedRoute] = useState(currentRoute);
  const [pageSteps] = useState<TourStep[]>(() => STEPS.filter((s) => (s.route ?? "dashboard") === openedRoute && targetExists(s.target)));
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardTop, setCardTop] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // The tour is scoped to whichever screen it was opened on. If the user
  // navigates elsewhere while it's up, just close it rather than following
  // them — each screen's coach is its own thing.
  useEffect(() => {
    if (currentRoute !== openedRoute) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoute]);

  useEffect(() => {
    if (pageSteps.length === 0) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag-to-move: once the user drags the card by its grip, it stays where
  // they put it (dragPos wins over the auto above/below-the-spotlight placement).
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  function onGripDown(e: RPointerEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const r = card.getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onGripMove(e: RPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const card = cardRef.current;
    if (!card) return;
    const x = Math.max(6, Math.min(e.clientX - dragOffset.current.dx, window.innerWidth - card.offsetWidth - 6));
    const y = Math.max(6, Math.min(e.clientY - dragOffset.current.dy, window.innerHeight - card.offsetHeight - 6));
    setDragPos({ x, y });
  }
  function onGripUp(e: RPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  useLayoutEffect(() => {
    if (pageSteps.length === 0) return;

    function findTarget() {
      const key = pageSteps[step].target;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`));
      // Mobile and desktop chrome both carry the attribute; only one is
      // actually on screen at a given width — pick whichever has real size.
      return candidates.find((el) => el.getClientRects().length > 0);
    }
    function place() {
      const visible = findTarget();
      setRect(visible ? visible.getBoundingClientRect() : null);
    }
    const target = findTarget();
    if (target) {
      const tall = target.getBoundingClientRect().height > window.innerHeight * 0.55;
      target.scrollIntoView({ block: tall ? "start" : "center", behavior: "auto" });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [step, pageSteps]);

  // Anchor the card above or below the spotlighted element (whichever side
  // has room) so it never sits on top of the thing it's explaining.
  useLayoutEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl || !rect) {
      setCardTop(null);
      return;
    }
    const vh = window.innerHeight;
    const cardH = cardEl.offsetHeight;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, vh);
    const spaceBelow = vh - visibleBottom;
    const spaceAbove = visibleTop;
    if (spaceBelow >= cardH + CARD_GAP) {
      setCardTop(visibleBottom + CARD_GAP);
    } else if (spaceAbove >= cardH + CARD_GAP) {
      setCardTop(visibleTop - cardH - CARD_GAP);
    } else {
      setCardTop(Math.max(CARD_GAP, vh - cardH - CARD_GAP));
    }
  }, [rect, step]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    // Any completed coach — on any page — is enough to stop auto-popping
    // the first-run one; it only needs to fire once, ever.
    markTourSeen();
    onDone();
  }

  function next() {
    if (step >= pageSteps.length - 1) finish();
    else setStep((s) => s + 1);
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (pageSteps.length === 0) return null;

  const s = pageSteps[step];
  const isLast = step === pageSteps.length - 1;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={s.title}>
      <div className="tour__scrim" style={{ background: rect ? "transparent" : undefined }} onClick={finish} />
      {rect && (
        <div
          className="tour__spot"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div
        ref={cardRef}
        className="tour__card"
        style={
          dragPos
            ? { left: dragPos.x, top: dragPos.y, right: "auto", bottom: "auto", transform: "none" }
            : cardTop === null
              ? undefined
              : ({ top: cardTop, bottom: "auto" } as CSSProperties)
        }
      >
        <div
          className="tour__grip"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          title="Drag to move"
          aria-label="Drag to move"
        />
        <div className="tour__dots">
          {pageSteps.map((st, i) => (
            <span key={st.target} className={`tour__dot${i === step ? " tour__dot--on" : ""}`} />
          ))}
        </div>
        <div className="tour__title">{s.title}</div>
        <p className="tour__body">{s.body}</p>
        <div className="tour__actions">
          <button className="btn btn--ghost" onClick={finish}>Skip</button>
          <div className="tour__actions-right">
            {step > 0 && <button className="btn btn--ghost" onClick={prev}>Back</button>}
            <button className="btn btn--primary" onClick={next}>{isLast ? "Got it" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
