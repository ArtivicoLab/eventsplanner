// "Event Search" detail view — pick one event from the query string (?id=)
// and see everything about it in one place: header, quick stats, info
// cards, then its own scoped Task Tracker and Expense Tracker.
import { useState } from "react";
import { navigate, routeQuery } from "../../router";
import { useEvents } from "../../stores/useEvents";
import { useEventTasks } from "../../stores/useEventTasks";
import { useExpenses } from "../../stores/useExpenses";
import { useRooms } from "../../stores/useRooms";
import { useGuests } from "../../stores/useGuests";
import { useSettings } from "../../stores/useSettings";
import { Icon, IconChevronLeft, IconEdit, IconEvents, IconPlus, IconSeat } from "../../components/icons";
import { EmptyState } from "../../components/EmptyState";
import { ProgressRing } from "../../components/ProgressRing";
import { CountUp } from "../../components/CountUp";
import { GroupedBars } from "../../components/Charts";
import { EventSheet } from "./EventSheet";
import { TaskSheet } from "../tasks/TaskSheet";
import { ExpenseSheet } from "../budget/ExpenseSheet";
import {
  eventStatusColor,
  money,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
} from "../../lib/ui";
import { daysBetween, dueLabel, format, fromISO, todayISO } from "../../lib/dates";
import type { EventTask, Expense } from "../../lib/types";

export function EventDetailScreen() {
  const id = routeQuery().get("id");
  const events = useEvents((s) => s.items);
  const tasks = useEventTasks((s) => s.items);
  const expenses = useExpenses((s) => s.items);
  const rooms = useRooms((s) => s.items);
  const guests = useGuests((s) => s.items);
  const eventStatusIcons = useSettings((s) => s.eventStatusIcons);

  const [editOpen, setEditOpen] = useState(false);
  const [taskSheet, setTaskSheet] = useState<{ open: boolean; taskId: string | null }>({
    open: false,
    taskId: null,
  });
  const [expenseSheet, setExpenseSheet] = useState<{ open: boolean; expenseId: string | null }>({
    open: false,
    expenseId: null,
  });

  const event = events.find((e) => e.id === id) ?? null;

  if (!event) {
    return (
      <EmptyState icon={<IconEvents size={28} />} title="Event not found" sub="It may have been deleted or the link is stale.">
        <button className="btn btn--primary btn--auto" onClick={() => navigate("events")}>
          Back to Events
        </button>
      </EmptyState>
    );
  }

  const eventTasks = tasks
    .filter((t) => t.eventId === event.id)
    .sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
  const eventExpenses = expenses
    .filter((x) => x.eventId === event.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const eventRooms = rooms.filter((rm) => rm.eventId === event.id);
  const eventGuests = guests.filter((g) => g.eventId === event.id);
  const seatedGuests = eventGuests.filter((g) => g.roomId);

  const totalSpent = eventExpenses.reduce((sum, x) => sum + x.amount, 0);
  const remaining = event.budget - totalSpent;
  const budgetPct = event.budget > 0 ? Math.max(0, Math.min(1, totalSpent / event.budget)) : 0;

  const today = todayISO();
  const diffStart = daysBetween(today, event.startDate);
  const diffEnd = daysBetween(today, event.endDate);
  let daysLabel: string;
  if (diffEnd < 0) daysLabel = "Event completed";
  else if (diffStart === 0) daysLabel = "Today";
  else if (diffStart > 0) daysLabel = `In ${diffStart}d`;
  else daysLabel = `${Math.abs(diffStart)}d ago`;

  const statusIcon = eventStatusIcons[event.status] ?? "circle";
  const hasAdditionalInfo = event.details.trim() !== "" || event.notes.trim() !== "";

  return (
    <div>
      <button className="btn btn--ghost btn--auto" onClick={() => navigate("events")} style={{ marginBottom: 16 }}>
        <IconChevronLeft size={16} /> Back
      </button>

      <div className="spread" style={{ alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title" style={{ marginBottom: 10, wordBreak: "break-word" }}>{event.name}</h1>
          <div className="chip-row">
            <span
              className="chip"
              style={{ background: eventStatusColor(event.status), borderColor: "transparent", color: "#fff" }}
            >
              <Icon name={statusIcon} size={14} />
              {event.status}
            </span>
            <span className="dotchip">
              <span className="dotchip__dot" style={{ background: PRIORITY_COLOR[event.priority] }} />
              {PRIORITY_LABEL[event.priority]}
            </span>
          </div>
        </div>
        <button className="btn btn--ghost btn--auto" onClick={() => setEditOpen(true)}>
          <IconEdit size={15} /> Edit
        </button>
      </div>

      {/* quick stats */}
      <div className="card">
        <div className="grid-2" style={{ alignItems: "center" }}>
          <div>
            <div className="section-title">Days to Start</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>{daysLabel}</div>
            <div className="muted fs-13" style={{ marginTop: 4 }}>
              {format(fromISO(event.startDate), "MMM d, yyyy")}
              {event.endDate !== event.startDate ? ` – ${format(fromISO(event.endDate), "MMM d, yyyy")}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <ProgressRing
              value={budgetPct}
              size={92}
              dotted={event.budget <= 0}
              ariaLabel={`Budget used: ${money(totalSpent)} of ${money(event.budget)}`}
              center={
                event.budget > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-display)" }}>
                      <CountUp value={remaining} format={(n) => money(n)} />
                    </span>
                    <span className="muted" style={{ fontSize: 10, fontWeight: 700 }}>left</span>
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: 11, fontWeight: 700, textAlign: "center", padding: "0 8px" }}>
                    No budget set
                  </span>
                )
              }
            />
            <div className="muted fs-13">Budget used</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <div>
            <div className="section-title" style={{ marginBottom: 2 }}>Seating Chart</div>
            <div className="muted fs-13">
              {eventGuests.length === 0
                ? "No guests added yet"
                : `${seatedGuests.length}/${eventGuests.length} guests seated`}
              {eventRooms.length > 0 ? ` · ${eventRooms.length} ${eventRooms.length === 1 ? "room" : "rooms"}` : ""}
            </div>
          </div>
          <button className="btn btn--ghost btn--auto" onClick={() => navigate("seating", { id: event.id })}>
            <IconSeat size={15} /> Open
          </button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Basic Info</div>
        <InfoRow label="Category" value={event.category} />
        <InfoRow label="Type" value={event.type} />
        <InfoRow label="Owner" value={event.owner} />
        <InfoRow label="Priority" value={PRIORITY_LABEL[event.priority]} />
      </div>

      <div className="card">
        <div className="section-title">When</div>
        <InfoRow
          label="Start"
          value={`${format(fromISO(event.startDate), "MMM d, yyyy")}${event.startTime ? ` · ${event.startTime}` : ""}`}
        />
        <InfoRow
          label="End"
          value={`${format(fromISO(event.endDate), "MMM d, yyyy")}${event.endTime ? ` · ${event.endTime}` : ""}`}
        />
      </div>

      <div className="card">
        <div className="section-title">Where</div>
        <InfoRow label="State" value={event.state} />
        <InfoRow label="Market/Region" value={event.marketRegion} />
        <InfoRow label="Location" value={event.location} />
      </div>

      {hasAdditionalInfo && (
        <div className="card">
          <div className="section-title">Additional Info</div>
          {event.details.trim() !== "" && (
            <div style={{ marginBottom: event.notes.trim() !== "" ? 14 : 0 }}>
              <div className="muted fs-13 mb-1">Details</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{event.details}</div>
            </div>
          )}
          {event.notes.trim() !== "" && (
            <div>
              <div className="muted fs-13 mb-1">Notes</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{event.notes}</div>
            </div>
          )}
        </div>
      )}

      <div className="love-divider" />

      <div className="spread" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Task Tracker</div>
        <button className="btn btn--ghost btn--auto" onClick={() => setTaskSheet({ open: true, taskId: null })}>
          <IconPlus size={15} /> Add Task
        </button>
      </div>
      {eventTasks.length === 0 ? (
        <p className="muted fs-13" style={{ marginBottom: 24 }}>No tasks yet for this event.</p>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          {eventTasks.map((t, i) => (
            <TaskRow key={t.id} task={t} first={i === 0} onClick={() => setTaskSheet({ open: true, taskId: t.id })} />
          ))}
        </div>
      )}

      <div className="spread" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Expense Tracker</div>
        <button className="btn btn--ghost btn--auto" onClick={() => setExpenseSheet({ open: true, expenseId: null })}>
          <IconPlus size={15} /> Add Expense
        </button>
      </div>

      <div className="card">
        <GroupedBars data={[{ label: event.name, budget: event.budget, actual: totalSpent }]} />
      </div>

      {eventExpenses.length === 0 ? (
        <p className="muted fs-13">No expenses logged yet for this event.</p>
      ) : (
        <div className="card">
          {eventExpenses.map((x, i) => (
            <ExpenseRow key={x.id} expense={x} first={i === 0} onClick={() => setExpenseSheet({ open: true, expenseId: x.id })} />
          ))}
        </div>
      )}

      <EventSheet open={editOpen} eventId={event.id} onClose={() => setEditOpen(false)} />
      <TaskSheet
        open={taskSheet.open}
        taskId={taskSheet.taskId}
        defaultEventId={event.id}
        onClose={() => setTaskSheet({ open: false, taskId: null })}
      />
      <ExpenseSheet
        open={expenseSheet.open}
        expenseId={expenseSheet.expenseId}
        defaultEventId={event.id}
        onClose={() => setExpenseSheet({ open: false, expenseId: null })}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="spread" style={{ padding: "7px 0", borderTop: "1px solid var(--hairline)" }}>
      <span className="muted fs-13">{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );
}

function TaskRow({ task, first, onClick }: { task: EventTask; first: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        borderTop: first ? "none" : "1px solid var(--hairline)",
        padding: "11px 0",
        cursor: "pointer",
      }}
    >
      <div className="spread spread--gap8">
        <span style={{ fontWeight: 700 }}>{task.task || "Untitled task"}</span>
        <span className="dotchip">
          <span className="dotchip__dot" style={{ background: TASK_STATUS_COLOR[task.status] }} />
          {TASK_STATUS_LABEL[task.status]}
        </span>
      </div>
      <div className="spread spread--gap8" style={{ marginTop: 4 }}>
        <span className="dotchip">
          <span className="dotchip__dot" style={{ background: PRIORITY_COLOR[task.priority] }} />
          {PRIORITY_LABEL[task.priority]}
        </span>
        <span className="muted fs-13">
          {task.dueDate ? dueLabel(task.dueDate) : "No due date"}
          {task.assignedTo ? ` · ${task.assignedTo}` : ""}
        </span>
      </div>
    </button>
  );
}

function ExpenseRow({ expense, first, onClick }: { expense: Expense; first: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        borderTop: first ? "none" : "1px solid var(--hairline)",
        padding: "11px 0",
        cursor: "pointer",
      }}
    >
      <div className="spread spread--gap8">
        <span style={{ fontWeight: 700 }}>{money(expense.amount)}</span>
        <span className="muted fs-13">{format(fromISO(expense.date), "MMM d, yyyy")}</span>
      </div>
      {expense.details && (
        <div className="muted fs-13" style={{ marginTop: 4 }}>{expense.details}</div>
      )}
    </button>
  );
}
