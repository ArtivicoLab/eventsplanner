// Add/edit sheet for a single Guest from the standalone Guests page. Unlike
// the quick-add/editor sheets nested inside SeatingScreen (which inherit the
// currently-selected event), this one carries its OWN event picker, since the
// Guests page spans every event at once. Seat placement stays a Seating-page
// concern; this sheet only owns who a guest is, which event, when they arrive.
import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { useEvents } from "../../stores/useEvents";
import { useGuests } from "../../stores/useGuests";
import { confirmDialog } from "../../stores/useConfirm";
import { useToast } from "../../stores/useToast";

interface Props {
  open: boolean;
  guestId: string | null;
  defaultEventId?: string;
  onClose: () => void;
}

export function GuestSheet({ open, guestId, defaultEventId, onClose }: Props) {
  const { items: events } = useEvents();
  const { items: guests, add, update, remove } = useGuests();
  const { show } = useToast();

  const editing = useMemo(
    () => (guestId ? guests.find((g) => g.id === guestId) ?? null : null),
    [guestId, guests]
  );

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0)),
    [events]
  );

  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [notes, setNotes] = useState("");

  // Reset (or prefill) on every open transition, never just first mount, or a
  // stale value silently carries into the next add/edit.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEventId(editing.eventId);
      setName(editing.name);
      setArrivalTime(editing.arrivalTime);
      setNotes(editing.notes);
    } else {
      setEventId(defaultEventId || sortedEvents[0]?.id || "");
      setName("");
      setArrivalTime("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guestId]);

  const canSave = !!eventId && name.trim() !== "";

  function save() {
    if (!canSave) return;
    if (editing) {
      // Moving a guest to a different event un-seats them: their old seat
      // belongs to the old event's floor plan and means nothing on the new one.
      const patch =
        eventId !== editing.eventId
          ? { eventId, name: name.trim(), arrivalTime, notes: notes.trim(), roomId: "", seatIndex: -1 }
          : { eventId, name: name.trim(), arrivalTime, notes: notes.trim() };
      update(editing.id, patch);
    } else {
      add({ eventId, name: name.trim(), roomId: "", seatIndex: -1, arrivalTime, notes: notes.trim() });
    }
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    const ok = await confirmDialog({
      title: `Remove ${editing.name || "this guest"}?`,
      message: "This removes them from the guest list and any seat they hold. This can't be undone.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    remove(editing.id);
    show({ message: "Guest removed" });
    onClose();
  }

  return (
    <BottomSheet open={open} title={editing ? "Edit Guest" : "Add Guest"} onClose={onClose}>
      <div className="field">
        <label className="field__label" htmlFor="guest-sheet-event">Event</label>
        <select
          id="guest-sheet-event"
          className="select"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="" disabled>Choose an event...</option>
          {sortedEvents.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name || "Untitled event"}</option>
          ))}
        </select>
        {events.length === 0 && (
          <p className="muted fs-13" style={{ marginTop: 6 }}>Create an event first before adding guests.</p>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="guest-sheet-name">Name</label>
        <input
          id="guest-sheet-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Guest name"
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="guest-sheet-arrival">Arrival time</label>
        <input
          id="guest-sheet-arrival"
          type="time"
          className="input"
          value={arrivalTime}
          onChange={(e) => setArrivalTime(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="guest-sheet-notes">Notes</label>
        <input
          id="guest-sheet-notes"
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Dietary restrictions, +1, etc."
        />
      </div>

      <button className={`btn btn--primary${editing ? " btn--stack" : ""}`} onClick={save} disabled={!canSave}>
        {editing ? "Save Changes" : "Add Guest"}
      </button>
      {editing && (
        <button className="btn btn--danger" onClick={handleDelete}>Remove Guest</button>
      )}
    </BottomSheet>
  );
}
