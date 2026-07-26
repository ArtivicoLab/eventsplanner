// Standalone Guests page: every guest across every event in one place,
// grouped by event, sorted by arrival time. Adding/editing a guest here picks
// its event via a dropdown (see GuestSheet). Seat placement stays on the
// Seating page; this page is about the guest list and when people show up.
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { Chip, ChipRow } from "../../components/Chip";
import { PageTourButton } from "../../components/PageTourButton";
import { IconGuests, IconPlus, IconEvents, IconSeat } from "../../components/icons";
import { useEvents } from "../../stores/useEvents";
import { useGuests } from "../../stores/useGuests";
import { useRooms } from "../../stores/useRooms";
import { formatTimeOfDay } from "../../lib/dates";
import { PICKABLE_CATEGORY_COLORS } from "../../lib/ui";
import { navigate, routeQuery } from "../../router";
import type { EventItem, Guest } from "../../lib/types";
import { GuestSheet } from "./GuestSheet";

function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PICKABLE_CATEGORY_COLORS[h % PICKABLE_CATEGORY_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Guests with an arrival time sort first (earliest first); the rest follow by
// name, so a fully-scheduled list reads top-to-bottom like a timeline.
function byArrivalThenName(a: Guest, b: Guest): number {
  if (a.arrivalTime && b.arrivalTime) return a.arrivalTime.localeCompare(b.arrivalTime) || a.name.localeCompare(b.name);
  if (a.arrivalTime) return -1;
  if (b.arrivalTime) return 1;
  return a.name.localeCompare(b.name);
}

export function GuestsScreen() {
  const { items: events } = useEvents();
  const { items: guests } = useGuests();
  const { items: rooms } = useRooms();

  const [eventFilter, setEventFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // A link from Seating/Events can preselect an event via ?id=.
  useEffect(() => {
    const id = routeQuery().get("id");
    if (id && events.some((e) => e.id === id)) setEventFilter(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0)),
    [events]
  );

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name || "";

  const shownEvents = eventFilter ? sortedEvents.filter((e) => e.id === eventFilter) : sortedEvents;
  const guestsByEvent = useMemo(() => {
    const m = new Map<string, Guest[]>();
    for (const g of guests) {
      if (!m.has(g.eventId)) m.set(g.eventId, []);
      m.get(g.eventId)!.push(g);
    }
    for (const list of m.values()) list.sort(byArrivalThenName);
    return m;
  }, [guests]);

  function openAdd() {
    setEditId(null);
    setSheetOpen(true);
  }
  function openEdit(id: string) {
    setEditId(id);
    setSheetOpen(true);
  }

  const groupsWithGuests = shownEvents.filter((e) => (guestsByEvent.get(e.id)?.length ?? 0) > 0);
  const withArrival = guests.filter((g) => g.arrivalTime).length;

  const subtitle =
    guests.length === 0
      ? "No guests yet"
      : `${guests.length} guest${guests.length === 1 ? "" : "s"} across ${guestsByEvent.size} event${guestsByEvent.size === 1 ? "" : "s"}` +
        (withArrival > 0 ? `, ${withArrival} with an arrival time` : "");

  return (
    <div>
      <div className="spread" style={{ alignItems: "flex-start", gap: 12, marginBottom: "var(--sp-4)" }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Guests</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>{subtitle}</p>
        </div>
        <PageTourButton />
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<IconEvents size={28} />}
          title="No events yet"
          sub="Add an event first, then start building its guest list here."
        >
          <button className="btn btn--primary btn--auto" onClick={() => navigate("events")}>Go to Events</button>
        </EmptyState>
      ) : (
        <>
          <button className="btn btn--primary btn--auto btn--stack" data-tour="guests-add" onClick={openAdd}>
            <IconPlus size={16} /> Add Guest
          </button>

          {sortedEvents.length > 1 && (
            <div className="field" data-tour="guests-filter">
              <div className="field__label">Filter by event</div>
              <ChipRow>
                <Chip active={eventFilter === ""} onClick={() => setEventFilter("")}>All events</Chip>
                {sortedEvents.map((e) => (
                  <Chip key={e.id} active={eventFilter === e.id} onClick={() => setEventFilter(e.id)}>
                    {e.name || "Untitled event"}
                  </Chip>
                ))}
              </ChipRow>
            </div>
          )}

          {guests.length === 0 ? (
            <EmptyState
              icon={<IconGuests size={28} />}
              title="No guests yet"
              sub="Add guests and set when each of them arrives. Arrivals show up in the Live feed."
            >
              <button className="btn btn--primary btn--auto" onClick={openAdd}>
                <IconPlus size={16} /> Add your first guest
              </button>
            </EmptyState>
          ) : groupsWithGuests.length === 0 ? (
            <EmptyState icon={<IconGuests size={28} />} title="No guests for this event" sub="Try a different event, or add one here." />
          ) : (
            <div data-tour="guests-list">
              {groupsWithGuests.map((event) => (
                <GuestGroup
                  key={event.id}
                  event={event}
                  guests={guestsByEvent.get(event.id) ?? []}
                  roomName={roomName}
                  onOpen={openEdit}
                />
              ))}
            </div>
          )}
        </>
      )}

      <GuestSheet
        open={sheetOpen}
        guestId={editId}
        defaultEventId={eventFilter || undefined}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}

function GuestGroup({
  event,
  guests,
  roomName,
  onOpen,
}: {
  event: EventItem;
  guests: Guest[];
  roomName: (id: string) => string;
  onOpen: (id: string) => void;
}) {
  const seated = guests.filter((g) => g.roomId).length;
  return (
    <section className="taskgroup">
      <div className="taskgroup__head">
        <h2>{event.name || "Untitled event"}</h2>
        <span className="taskgroup__count">{guests.length}</span>
      </div>
      <div className="taskgroup__card">
        {guests.map((g) => {
          const room = g.roomId ? roomName(g.roomId) : "";
          return (
            <div key={g.id} className="task" style={{ cursor: "pointer" }} onClick={() => onOpen(g.id)}>
              <span
                className="guestrow__avatar"
                style={{ background: hashColor(g.id), flex: "none" }}
                aria-hidden
              >
                {initials(g.name)}
              </span>
              <span className="task__body">
                <span className="task__title">{g.name || "Unnamed guest"}</span>
                <span className="list__sub">
                  {room ? `Seated at ${room}, seat ${g.seatIndex + 1}` : "Unseated"}
                  {g.notes ? ` · ${g.notes}` : ""}
                </span>
              </span>
              {g.arrivalTime ? (
                <span className="pill" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>
                  {formatTimeOfDay(g.arrivalTime)}
                </span>
              ) : (
                <span className="duelabel">No arrival</span>
              )}
            </div>
          );
        })}
        <div className="muted fs-13" style={{ padding: "10px 0 6px", display: "flex", alignItems: "center", gap: 8 }}>
          <IconSeat size={14} /> {seated}/{guests.length} seated
          <button
            className="btn btn--ghost btn--auto"
            style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12.5 }}
            onClick={() => navigate("seating", { id: event.id })}
          >
            Open seating
          </button>
        </div>
      </div>
    </section>
  );
}
