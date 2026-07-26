// Global Event Task Tracker: every task across every event, not scoped to
// any single one (see EventDetailScreen for a per-event task list). Ported
// from first-love-tasks.html, the owner's reference mockup: tasks triage
// into "Needs attention" (overdue), "Coming up" (due within a week), and
// "Scheduled" (everything else), matching the same not-Complete-or-
// Cancelled convention the Dashboard's own upcoming-tasks list already uses.
import { useEffect, useMemo, useState } from "react";
import { Chip, ChipRow } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { IconPlus, IconSearch, IconTasks } from "../../components/icons";
import { TaskSheet } from "./TaskSheet";
import { useEventTasks } from "../../stores/useEventTasks";
import { useEvents } from "../../stores/useEvents";
import { daysBetween, dueLabel, isOverdueISO, todayISO } from "../../lib/dates";
import { categoryColor, PRIORITY_COLOR, PRIORITY_LABEL, TASK_STATUS_COLOR, TASK_STATUS_LABEL } from "../../lib/ui";
import { PRIORITIES, TASK_STATUSES, type EventItem, type EventTask, type Priority, type TaskStatus } from "../../lib/types";
import { navigate, routeQuery } from "../../router";

type DueVariant = "overdue" | "tomorrow" | "soon" | "later";

function dueVariant(dueDate: string, today: string): DueVariant {
  if (!dueDate) return "later";
  if (isOverdueISO(dueDate, today)) return "overdue";
  const diff = daysBetween(today, dueDate);
  if (diff === 1) return "tomorrow";
  if (diff < 7) return "soon";
  return "later";
}

function byDueDate(a: EventTask, b: EventTask): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TasksScreen() {
  const { items: tasks } = useEventTasks();
  const { items: events } = useEvents();

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [eventFilter, setEventFilter] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  function openAdd() {
    setEditId(null);
    setSheetOpen(true);
  }
  function openTask(id: string) {
    setEditId(id);
    setSheetOpen(true);
  }

  // A link elsewhere in the app (e.g. an event's detail screen, a dashboard
  // reminder) can land here pointed at one specific task via ?id=.
  useEffect(() => {
    const id = routeQuery().get("id");
    if (id && tasks.some((t) => t.id === id)) openTask(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtersActive = !!statusFilter || !!priorityFilter || !!eventFilter;

  const filtered = tasks.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (eventFilter && t.eventId !== eventFilter) return false;
    return true;
  });

  const today = todayISO();
  // Filtering explicitly to a resolved status is a request to SEE resolved
  // tasks, not to triage them by urgency: show a plain list instead of the
  // 3 buckets, which assume "not done yet" for all of them.
  const showResolvedFlat = statusFilter === "Complete" || statusFilter === "Cancelled";
  const active = useMemo(
    () => filtered.filter((t) => t.status !== "Complete" && t.status !== "Cancelled"),
    [filtered]
  );

  const needsAttention = useMemo(
    () => active.filter((t) => dueVariant(t.dueDate, today) === "overdue").sort(byDueDate),
    [active, today]
  );
  const comingUp = useMemo(
    () => active.filter((t) => dueVariant(t.dueDate, today) === "tomorrow" || dueVariant(t.dueDate, today) === "soon").sort(byDueDate),
    [active, today]
  );
  const scheduled = useMemo(
    () => active.filter((t) => dueVariant(t.dueDate, today) === "later").sort(byDueDate),
    [active, today]
  );
  const dueTomorrowCount = useMemo(
    () => active.filter((t) => t.dueDate && daysBetween(today, t.dueDate) === 1).length,
    [active, today]
  );

  const subtitle =
    tasks.length === 0
      ? "Nothing tracked yet"
      : filtersActive
        ? `${filtered.length} of ${tasks.length} task${tasks.length === 1 ? "" : "s"} shown`
        : `${active.length} task${active.length === 1 ? "" : "s"} across every event`;

  return (
    <div>
      <div className="spread" style={{ alignItems: "flex-end", gap: 12, marginBottom: "var(--sp-4)" }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Tasks</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>{subtitle}</p>
        </div>
        <button className="btn btn--primary btn--auto" data-tour="tasks-add" onClick={openAdd}>
          <IconPlus size={16} /> Add Task
        </button>
      </div>

      {!showResolvedFlat && tasks.length > 0 && (
        <div className="triage" role="status" data-tour="tasks-triage">
          <span className="tri tri--hot">
            <span className="tri__dot" aria-hidden />
            {needsAttention.length} need attention
          </span>
          {dueTomorrowCount > 0 && (
            <span className="tri tri--soon">
              <span className="tri__dot" aria-hidden />
              {dueTomorrowCount} due tomorrow
            </span>
          )}
          <span className="tri tri--all">
            <span className="tri__dot" aria-hidden />
            {active.length} total
          </span>
        </div>
      )}

      <div className="card" data-tour="tasks-filters" style={{ marginBottom: "var(--sp-4)" }}>
        <div className="section-title">Filters</div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label className="field__label">Status</label>
          <ChipRow>
            {TASK_STATUSES.map((s) => (
              <Chip
                key={s}
                active={statusFilter === s}
                dotColor={TASK_STATUS_COLOR[s]}
                onClick={() => setStatusFilter((f) => (f === s ? "" : s))}
              >
                {TASK_STATUS_LABEL[s]}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label className="field__label">Priority</label>
          <ChipRow>
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                active={priorityFilter === p}
                dotColor={PRIORITY_COLOR[p]}
                onClick={() => setPriorityFilter((f) => (f === p ? "" : p))}
              >
                {PRIORITY_LABEL[p]}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label" htmlFor="tasks-event-filter">Event</label>
          <select
            id="tasks-event-filter"
            className="select"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name || "Untitled event"}</option>
            ))}
          </select>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<IconTasks size={28} />}
          title="No tasks yet"
          sub="Add your first task to start tracking what needs doing across your events."
        >
          <button className="btn btn--primary btn--auto" onClick={openAdd}>
            <IconPlus size={16} /> Add Task
          </button>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch size={28} />}
          title="No tasks match these filters"
          sub="Try clearing a filter above to see more."
        />
      ) : showResolvedFlat ? (
        <div className="taskgroup" data-tour="tasks-list">
          <div className="taskgroup__head">
            <h2>{TASK_STATUS_LABEL[statusFilter as TaskStatus]}</h2>
            <span className="taskgroup__count">{filtered.length}</span>
          </div>
          <div className="taskgroup__card">
            {filtered.map((t) => (
              <TaskRow key={t.id} task={t} event={eventById.get(t.eventId)} today={today} onOpen={() => openTask(t.id)} />
            ))}
          </div>
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={<IconTasks size={28} />}
          title="All caught up"
          sub="Every task matching these filters is already complete or cancelled."
        />
      ) : (
        <div data-tour="tasks-list">
          <TaskGroup title="Needs attention" hot tasks={needsAttention} eventById={eventById} today={today} onOpen={openTask} />
          <TaskGroup title="Coming up" tasks={comingUp} eventById={eventById} today={today} onOpen={openTask} />
          <TaskGroup title="Scheduled" tasks={scheduled} eventById={eventById} today={today} onOpen={openTask} />
        </div>
      )}

      <TaskSheet open={sheetOpen} taskId={editId} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

function TaskGroup({
  title,
  hot,
  tasks,
  eventById,
  today,
  onOpen,
}: {
  title: string;
  hot?: boolean;
  tasks: EventTask[];
  eventById: Map<string, EventItem>;
  today: string;
  onOpen: (id: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="taskgroup">
      <div className={`taskgroup__head${hot ? " taskgroup__head--hot" : ""}`}>
        <h2>{title}</h2>
        <span className="taskgroup__count">{tasks.length}</span>
      </div>
      <div className={`taskgroup__card${hot ? " taskgroup__card--hot" : ""}`}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} event={eventById.get(t.eventId)} today={today} onOpen={() => onOpen(t.id)} />
        ))}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  event,
  today,
  onOpen,
}: {
  task: EventTask;
  event: EventItem | undefined;
  today: string;
  onOpen: () => void;
}) {
  const variant = dueVariant(task.dueDate, today);
  return (
    <div className="task" style={{ cursor: "pointer" }} onClick={onOpen}>
      <span className="ring" style={{ borderColor: PRIORITY_COLOR[task.priority] }} aria-hidden />
      <span className="task__body">
        <span className="task__title">{task.task || "Untitled task"}</span>
        <span className="task__meta">
          {event && (
            <button
              className="pill"
              style={{
                color: `color-mix(in srgb, ${categoryColor(event.category)}, var(--ink))`,
                background: `color-mix(in srgb, ${categoryColor(event.category)} 22%, var(--surface))`,
                border: "none",
              }}
              onClick={(e) => {
                e.stopPropagation();
                navigate("eventdetail", { id: event.id });
              }}
            >
              {event.name || "Untitled event"}
            </button>
          )}
          <span className="dotchip">
            <span className="dotchip__dot" style={{ background: TASK_STATUS_COLOR[task.status] }} />
            {TASK_STATUS_LABEL[task.status]}
          </span>
          <span className="dotchip">
            <span className="dotchip__dot" style={{ background: PRIORITY_COLOR[task.priority] }} />
            {PRIORITY_LABEL[task.priority]}
          </span>
        </span>
      </span>
      {task.assignedTo && (
        <span className="task__assignee">
          <span className="avatar" style={{ width: 24, height: 24, fontSize: 9.5 }}>{initials(task.assignedTo)}</span>
          <span>{task.assignedTo}</span>
        </span>
      )}
      <span className={`taskdue taskdue--${variant}`}>{task.dueDate ? dueLabel(task.dueDate, today) : "No due date"}</span>
    </div>
  );
}
