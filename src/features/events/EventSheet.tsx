// Add / edit sheet for a single Event — Event Tracker's core record.
import { useId, useMemo, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { useEvents } from "../../stores/useEvents";
import { useEventTasks } from "../../stores/useEventTasks";
import { useExpenses } from "../../stores/useExpenses";
import { useRooms } from "../../stores/useRooms";
import { useGuests } from "../../stores/useGuests";
import { useSettings } from "../../stores/useSettings";
import { confirmDialog } from "../../stores/useConfirm";
import { useToast } from "../../stores/useToast";
import { todayISO } from "../../lib/dates";
import { PRIORITIES, type EventItem, type Priority } from "../../lib/types";
import { PRIORITY_LABEL } from "../../lib/ui";

interface Props {
  open: boolean;
  eventId: string | null;
  onClose: () => void;
}

// Keeps a value that's no longer in a Setup list (renamed/removed since this
// record was saved) visible as an extra option instead of silently dropping
// it the moment the sheet opens — see CLAUDE.md's "never silently drop a
// stale value" convention.
function withExtra(list: string[], current: string): string[] {
  if (!current || list.includes(current)) return list;
  return [...list, current];
}

export function EventSheet({ open, eventId, onClose }: Props) {
  const { items: events, add: addEvent, update: updateEvent, remove: removeEvent } = useEvents();
  const { items: eventTasks, remove: removeEventTask } = useEventTasks();
  const { items: expenses, remove: removeExpense } = useExpenses();
  const { items: rooms, remove: removeRoom } = useRooms();
  const { items: guests, remove: removeGuest } = useGuests();
  const settings = useSettings();
  const { show: showToast } = useToast();
  const marketListId = useId();

  const editingEvent = eventId ? (events.find((e) => e.id === eventId) ?? null) : null;
  const editing = !!editingEvent;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState(todayISO());
  const [endTime, setEndTime] = useState("");
  const [marketRegion, setMarketRegion] = useState("");
  const [location, setLocation] = useState("");
  const [state, setState] = useState("");
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [status, setStatus] = useState("");
  const [budget, setBudget] = useState(0);
  const [details, setDetails] = useState("");
  const [notes, setNotes] = useState("");

  // Reset every field on the transition to open — never let a stale value
  // from a previous open (add or a different edit) leak into this one.
  useMemo(() => {
    if (!open) return;
    if (editingEvent) {
      setName(editingEvent.name);
      setCategory(editingEvent.category);
      setType(editingEvent.type);
      setStartDate(editingEvent.startDate);
      setStartTime(editingEvent.startTime);
      setEndDate(editingEvent.endDate);
      setEndTime(editingEvent.endTime);
      setMarketRegion(editingEvent.marketRegion);
      setLocation(editingEvent.location);
      setState(editingEvent.state);
      setOwner(editingEvent.owner);
      setPriority(editingEvent.priority);
      setStatus(editingEvent.status);
      setBudget(editingEvent.budget);
      setDetails(editingEvent.details);
      setNotes(editingEvent.notes);
    } else {
      setName("");
      setCategory(settings.categories[0] ?? "");
      setType(settings.eventTypes[0] ?? "");
      setStartDate(todayISO());
      setStartTime("");
      setEndDate(todayISO());
      setEndTime("");
      setMarketRegion("");
      setLocation("");
      setState(settings.states[0] ?? "");
      setOwner("");
      setPriority("Medium");
      setStatus(settings.eventStatuses[0] ?? "");
      setBudget(0);
      setDetails("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId]);

  const categoryOptions = withExtra(settings.categories, category);
  const typeOptions = withExtra(settings.eventTypes, type);
  const stateOptions = withExtra(settings.states, state);
  const statusOptions = withExtra(settings.eventStatuses, status);
  const ownerOptions = withExtra(settings.owners, owner);

  function onStartDateChange(v: string) {
    setStartDate(v);
    if (endDate < v) setEndDate(v);
  }
  function onEndDateChange(v: string) {
    setEndDate(v < startDate ? startDate : v);
  }

  function save() {
    const n = name.trim();
    if (!n) return;
    const patch: Partial<EventItem> = {
      name: n,
      category,
      type,
      startDate,
      startTime,
      endDate: endDate < startDate ? startDate : endDate,
      endTime,
      marketRegion: marketRegion.trim(),
      location: location.trim(),
      state,
      owner,
      priority,
      status,
      budget: Number(budget) || 0,
      details,
      notes,
    };
    if (editingEvent) {
      updateEvent(editingEvent.id, patch);
    } else {
      addEvent(patch);
    }
    onClose();
  }

  async function handleDelete() {
    if (!editingEvent) return;
    const ok = await confirmDialog({
      title: "Delete event?",
      message: "This also removes its tasks, expenses, and seating chart. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    for (const t of eventTasks.filter((t) => t.eventId === editingEvent.id)) removeEventTask(t.id);
    for (const ex of expenses.filter((ex) => ex.eventId === editingEvent.id)) removeExpense(ex.id);
    for (const g of guests.filter((g) => g.eventId === editingEvent.id)) removeGuest(g.id);
    for (const rm of rooms.filter((rm) => rm.eventId === editingEvent.id)) removeRoom(rm.id);
    removeEvent(editingEvent.id);
    showToast({ message: "Event deleted" });
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? "Edit event" : "New event"}>
      <div className="field">
        <label className="field__label" htmlFor="ev-name">Name</label>
        <input
          id="ev-name"
          className="input"
          autoFocus
          value={name}
          placeholder="e.g. Harper & Sam's Wedding"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="ev-category">Category</label>
          <select id="ev-category" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ev-type">Type</label>
          <select id="ev-type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="ev-start-date">Start date</label>
          <input
            id="ev-start-date"
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ev-start-time">Start time</label>
          <input
            id="ev-start-time"
            type="time"
            className="input"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="ev-end-date">End date</label>
          <input
            id="ev-end-date"
            type="date"
            className="input"
            min={startDate}
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ev-end-time">End time</label>
          <input
            id="ev-end-time"
            type="time"
            className="input"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="ev-market">Market / Region</label>
          <input
            id="ev-market"
            className="input"
            list={marketListId}
            value={marketRegion}
            placeholder="e.g. Austin, TX"
            onChange={(e) => setMarketRegion(e.target.value)}
          />
          <datalist id={marketListId}>
            {settings.marketRegions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ev-location">Location</label>
          <input
            id="ev-location"
            className="input"
            value={location}
            placeholder="Venue or address"
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="ev-state">State</label>
          <select id="ev-state" className="select" value={state} onChange={(e) => setState(e.target.value)}>
            {stateOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ev-owner">Owner</label>
          <select id="ev-owner" className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Unassigned</option>
            {ownerOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="ev-priority">Priority</label>
          <select
            id="ev-priority"
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ev-status">Status</label>
          <select id="ev-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="ev-budget">Budget ({settings.currency})</label>
        <input
          id="ev-budget"
          type="number"
          min={0}
          className="input"
          value={budget}
          onChange={(e) => setBudget(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="ev-details">Details</label>
        <textarea
          id="ev-details"
          className="textarea"
          value={details}
          placeholder="What's this event about?"
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="ev-notes">Notes</label>
        <textarea
          id="ev-notes"
          className="textarea"
          value={notes}
          placeholder="Anything else worth remembering"
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button className="btn btn--primary btn--stack" onClick={save} disabled={!name.trim()}>
        {editing ? "Save changes" : "Add event"}
      </button>

      {editing && (
        <button className="btn btn--danger" onClick={handleDelete}>
          Delete event
        </button>
      )}
    </BottomSheet>
  );
}
