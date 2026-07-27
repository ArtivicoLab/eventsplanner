// The global "Event Budget" screen: budget-vs-actual across every event,
// plus a master expense log. Route "budget".
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { CountUp } from "../../components/CountUp";
import { Donut, GroupedBars, type GroupedDatum } from "../../components/Charts";
import { IconBudget, IconPlus, IconReceipt } from "../../components/icons";
import { useEvents } from "../../stores/useEvents";
import { useExpenses } from "../../stores/useExpenses";
import { useSettings } from "../../stores/useSettings";
import { onActivateKey } from "../../lib/a11y";
import { categoryColor, money } from "../../lib/ui";
import { format, fromISO } from "../../lib/dates";
import { navigate } from "../../router";
import { ExpenseSheet } from "./ExpenseSheet";

const CHART_CAP = 10;

export function BudgetScreen() {
  const { items: events } = useEvents();
  const { items: expenses } = useExpenses();
  const { currency } = useSettings();

  const [eventFilter, setEventFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const totalBudget = useMemo(() => events.reduce((a, e) => a + (e.budget || 0), 0), [events]);
  const totalSpent = useMemo(() => expenses.reduce((a, e) => a + (e.amount || 0), 0), [expenses]);
  const remaining = totalBudget - totalSpent;

  const spentByEvent = useMemo(() => {
    const m = new Map<string, number>();
    for (const ex of expenses) m.set(ex.eventId, (m.get(ex.eventId) ?? 0) + (ex.amount || 0));
    return m;
  }, [expenses]);

  // Where the money actually goes, not just how much of it: a real budget
  // tool answers both "am I over budget" (the chart below) and "on what".
  const spendByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const ex of expenses) {
      const key = ex.category || "Uncategorized";
      m.set(key, (m.get(key) ?? 0) + (ex.amount || 0));
    }
    return Array.from(m, ([label, value]) => ({ label, value, color: categoryColor(label) }));
  }, [expenses]);

  // Events over budget sort first, worst overage first, so a small event
  // that's badly over budget is never bumped out of the CHART_CAP by a
  // big-budget event that's actually fine, sorting by budget size alone
  // would do exactly that.
  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const overA = Math.max(0, (spentByEvent.get(a.id) ?? 0) - (a.budget || 0));
        const overB = Math.max(0, (spentByEvent.get(b.id) ?? 0) - (b.budget || 0));
        if (overA !== overB) return overB - overA;
        return (b.budget || 0) - (a.budget || 0);
      }),
    [events, spentByEvent]
  );
  const chartEvents = sortedEvents.slice(0, CHART_CAP);
  const hiddenCount = Math.max(0, sortedEvents.length - CHART_CAP);
  const chartData: GroupedDatum[] = chartEvents.map((e) => ({
    label: e.name || "Untitled event",
    budget: e.budget || 0,
    actual: spentByEvent.get(e.id) ?? 0,
  }));

  const filteredExpenses = useMemo(() => {
    const list = eventFilter ? expenses.filter((e) => e.eventId === eventFilter) : expenses;
    return [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [expenses, eventFilter]);

  function eventName(id: string): string {
    return events.find((e) => e.id === id)?.name || "Untitled event";
  }

  function openAdd() {
    setEditId(null);
    setSheetOpen(true);
  }
  function openEdit(id: string) {
    setEditId(id);
    setSheetOpen(true);
  }

  return (
    <>
      <h1 className="page-title">Budget</h1>
      <p className="page-sub">Budget vs. actual across every event, plus every expense you've logged.</p>

      <div className="grid-3" data-tour="budget-stats">
        <StatTile label="Total Budget" value={totalBudget} currency={currency} />
        <StatTile label="Total Spent" value={totalSpent} currency={currency} />
        <StatTile label="Remaining" value={remaining} currency={currency} negative={remaining < 0} />
      </div>

      <div className="love-divider" />

      <div className="section-title">Budget vs. Actual by Event</div>
      {chartData.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconBudget size={28} />}
            title="No events yet"
            sub="Create an event to start tracking its budget."
          />
        </div>
      ) : (
        <div className="card" data-tour="budget-chart">
          <GroupedBars data={chartData} />
          {hiddenCount > 0 && (
            <p className="muted fs-13" style={{ marginTop: 12 }}>
              +{hiddenCount} more event{hiddenCount === 1 ? "" : "s"} not shown
            </p>
          )}
        </div>
      )}

      {spendByCategory.length > 0 && (
        <>
          <div className="love-divider" />
          <div className="section-title">Spending by Category</div>
          <div className="card" data-tour="budget-category">
            <Donut slices={spendByCategory} />
          </div>
        </>
      )}

      <div className="love-divider" />

      <div className="spread" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Expense Tracker</div>
        <button className="btn btn--primary btn--auto" data-tour="budget-add" onClick={openAdd}>
          <IconPlus size={16} />
          Add Expense
        </button>
      </div>

      {events.length > 0 && (
        <div className="field">
          <label className="field__label" htmlFor="budget-event-filter">Event</label>
          <select
            id="budget-event-filter"
            className="select"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name || "Untitled event"}</option>
            ))}
          </select>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconReceipt size={28} />}
            title="No expenses logged"
            sub="Add your first expense to start tracking what's actually being spent."
          >
            <button className="btn btn--primary btn--auto" onClick={openAdd}>Add Expense</button>
          </EmptyState>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconReceipt size={28} />}
            title="No expenses for this event"
            sub="Try a different event, or log one here."
          />
        </div>
      ) : (
        <div className="card" style={{ padding: "4px 16px" }}>
          {filteredExpenses.map((ex, i) => (
            <div key={ex.id}>
              <div
                className="spread"
                role="button"
                tabIndex={0}
                onClick={() => openEdit(ex.id)}
                onKeyDown={onActivateKey(() => openEdit(ex.id))}
                style={{ padding: "12px 0", cursor: "pointer" }}
              >
                <div style={{ minWidth: 0 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("eventdetail", { id: ex.eventId });
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--accent)",
                      textAlign: "left",
                    }}
                  >
                    {eventName(ex.eventId)}
                  </button>
                  <div className="muted fs-13" style={{ marginTop: 2 }}>
                    {format(fromISO(ex.date), "MMM d, yyyy")}
                    {ex.category ? ` · ${ex.category}` : ""}
                    {ex.details ? ` · ${ex.details}` : ""}
                  </div>
                </div>
                <div style={{ fontWeight: 700, flex: "none", marginLeft: 12 }}>{money(ex.amount, currency)}</div>
              </div>
              {i < filteredExpenses.length - 1 && <div style={{ borderTop: "1px solid var(--hairline)" }} />}
            </div>
          ))}
        </div>
      )}

      <ExpenseSheet
        open={sheetOpen}
        expenseId={editId}
        defaultEventId={eventFilter || undefined}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

function StatTile({
  label,
  value,
  currency,
  negative,
}: {
  label: string;
  value: number;
  currency: string;
  negative?: boolean;
}) {
  return (
    <div className="card">
      <div className="muted fs-13 mb-1">{label}</div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          fontWeight: 700,
          color: negative ? "var(--alert)" : undefined,
        }}
      >
        <CountUp value={value} format={(n) => money(n, currency)} />
      </div>
    </div>
  );
}
