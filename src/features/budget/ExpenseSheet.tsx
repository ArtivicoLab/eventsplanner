// Add/edit sheet for a single Expense line, logged against one Event.
// Contract (depended on by BudgetScreen.tsx and, eventually, an event-detail
// screen): { open, expenseId, defaultEventId?, onClose }.
import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { useEvents } from "../../stores/useEvents";
import { useExpenses } from "../../stores/useExpenses";
import { useSettings } from "../../stores/useSettings";
import { confirmDialog } from "../../stores/useConfirm";
import { useToast } from "../../stores/useToast";
import { todayISO } from "../../lib/dates";

interface Props {
  open: boolean;
  expenseId: string | null;
  defaultEventId?: string;
  onClose: () => void;
}

export function ExpenseSheet({ open, expenseId, defaultEventId, onClose }: Props) {
  const { items: events } = useEvents();
  const { items: expenses, add, update, remove } = useExpenses();
  const { expenseCategories } = useSettings();
  const { show } = useToast();

  const editing = useMemo(
    () => (expenseId ? expenses.find((e) => e.id === expenseId) ?? null : null),
    [expenseId, expenses]
  );

  const [eventId, setEventId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");

  // Reset (or prefill) every time the sheet transitions to open — never just
  // at first mount, or a stale value from a previous open silently carries
  // into the next add/edit (a known, previously-shipped bug class here).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEventId(editing.eventId);
      setDate(editing.date || todayISO());
      setAmount(editing.amount || editing.amount === 0 ? String(editing.amount) : "");
      setCategory(editing.category || "");
      setDetails(editing.details || "");
    } else {
      setEventId(defaultEventId || "");
      setDate(todayISO());
      setAmount("");
      setCategory("");
      setDetails("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expenseId]);

  // Preset + lock the event picker when opened from an event's own context
  // (a chosen filter, or a future event-detail screen) — mirrors TaskSheet's
  // contract. Only locks on CREATE; editing an existing expense always shows
  // its real event, editable.
  const locked = !editing && !!defaultEventId;
  const lockedEventName = locked ? events.find((e) => e.id === defaultEventId)?.name : undefined;

  // Validate against the raw input string, not the parsed number's
  // truthiness — a legitimately-entered "0" amount must stay valid.
  const amountValid = amount.trim() !== "" && !Number.isNaN(Number(amount)) && Number(amount) >= 0;
  const canSave = !!eventId && amountValid;

  function save() {
    if (!canSave) return;
    const patch = {
      eventId,
      date: date || todayISO(),
      amount: Number(amount) || 0,
      category,
      details: details.trim(),
    };
    if (editing) {
      update(editing.id, patch);
    } else {
      add(patch);
    }
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: "Delete expense?",
      message: `Delete this expense${editing.details ? ` ("${editing.details}")` : ""}? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    remove(editing.id);
    show({ message: "Expense deleted" });
    onClose();
  }

  return (
    <BottomSheet open={open} title={editing ? "Edit Expense" : "Add Expense"} onClose={onClose}>
      <div className="field">
        <label className="field__label" htmlFor="expense-event">Event</label>
        <select
          id="expense-event"
          className="select"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          disabled={locked}
        >
          <option value="" disabled>Choose an event...</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name || "Untitled event"}</option>
          ))}
        </select>
        {locked && lockedEventName && (
          <p className="muted fs-13" style={{ marginTop: 6 }}>Logging against {lockedEventName}.</p>
        )}
        {events.length === 0 && (
          <p className="muted fs-13" style={{ marginTop: 6 }}>Create an event first before logging an expense.</p>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="expense-category">Category</label>
        <select
          id="expense-category"
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Uncategorized</option>
          {expenseCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="expense-date">Date</label>
          <input
            id="expense-date"
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="expense-amount">Amount</label>
          <input
            id="expense-amount"
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="expense-details">Details</label>
        <input
          id="expense-details"
          className="input"
          type="text"
          placeholder="e.g. Catering deposit"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      <button
        className={`btn btn--primary${editing ? " btn--stack" : ""}`}
        onClick={save}
        disabled={!canSave}
      >
        {editing ? "Save Changes" : "Add Expense"}
      </button>
      {editing && (
        <button className="btn btn--danger" onClick={handleDelete}>Delete Expense</button>
      )}
    </BottomSheet>
  );
}
