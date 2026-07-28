// Standalone Guests page: every guest across every event in one place,
// grouped by event, then by table within each event — mirroring how the
// Seating page itself organizes people, so "Head Table" here and "Head
// Table" on the floor plan read as the same concept. Anyone not yet placed
// lands in its own "Needs a seat" group with a quick assign-seat action, so
// seating someone doesn't require leaving this page. Seat/table CRUD itself
// still lives on Seating; this page is about the guest list, who's where,
// and when people show up. (Redesign ported from guests-page-redesign.html,
// the owner's reference mockup — restyled with this app's own tokens rather
// than the mockup's own literal colors, and adapted to this app's actual
// Guest model: no separate role/diet/plus-one fields exist, so `notes`
// stands in for all of those as plain text, same as it always has.)
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { Checkbox } from "../../components/Checkbox";
import { Chip, ChipRow } from "../../components/Chip";
import { PageTourButton } from "../../components/PageTourButton";
import { BottomSheet } from "../../components/BottomSheet";
import { IconGuests, IconPlus, IconEvents, IconSeat, IconSearch } from "../../components/icons";
import { useEvents } from "../../stores/useEvents";
import { useGuests } from "../../stores/useGuests";
import { useRooms } from "../../stores/useRooms";
import { useToast } from "../../stores/useToast";
import { onActivateKey } from "../../lib/a11y";
import { formatTimeOfDay } from "../../lib/dates";
import { hashColor, initials, pct, PICKABLE_CATEGORY_COLORS } from "../../lib/ui";
import { navigate, routeQuery } from "../../router";
import type { EventItem, Guest, Room } from "../../lib/types";
import { GuestSheet } from "./GuestSheet";

export function GuestsScreen() {
  const { items: events } = useEvents();
  const { items: guests, update: updateGuest } = useGuests();
  const { items: rooms } = useRooms();
  const { show: showToast } = useToast();

  const [eventFilter, setEventFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [assignGuestId, setAssignGuestId] = useState<string | null>(null);

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

  const guestsByEvent = useMemo(() => {
    const m = new Map<string, Guest[]>();
    for (const g of guests) {
      if (!m.has(g.eventId)) m.set(g.eventId, []);
      m.get(g.eventId)!.push(g);
    }
    return m;
  }, [guests]);

  const q = search.trim().toLowerCase();
  function matchesSearch(g: Guest): boolean {
    if (!q) return true;
    return g.name.toLowerCase().includes(q) || g.notes.toLowerCase().includes(q);
  }

  const shownEvents = eventFilter ? sortedEvents.filter((e) => e.id === eventFilter) : sortedEvents;
  const renderedEvents = shownEvents.filter((e) => (guestsByEvent.get(e.id) ?? []).some(matchesSearch));

  function openAdd() {
    setEditId(null);
    setSheetOpen(true);
  }
  function openEdit(id: string) {
    setEditId(id);
    setSheetOpen(true);
  }

  // Stats scope to whatever's currently filtered — picking one event's chip
  // makes the numbers above answer "how's THIS event's guest list doing",
  // not an unrelated global count.
  const statsGuests = eventFilter ? guestsByEvent.get(eventFilter) ?? [] : guests;
  const statSeated = statsGuests.filter((g) => g.roomId).length;
  const statArrived = statsGuests.filter((g) => g.arrived).length;
  const statNeedSeat = statsGuests.length - statSeated;

  const assignGuest = assignGuestId ? guests.find((g) => g.id === assignGuestId) ?? null : null;
  const assignRooms = assignGuest ? rooms.filter((r) => r.eventId === assignGuest.eventId) : [];
  const assignEventGuests = assignGuest ? guestsByEvent.get(assignGuest.eventId) ?? [] : [];

  return (
    <div>
      <div className="spread" style={{ alignItems: "flex-start", gap: 12, marginBottom: "var(--sp-4)" }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Guests</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>Every guest, grouped by table.</p>
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
      ) : guests.length === 0 ? (
        <EmptyState
          icon={<IconGuests size={28} />}
          title="No guests yet"
          sub="Add guests and set when each of them arrives. Arrivals show up in the Live feed."
        >
          <button className="btn btn--primary btn--auto" onClick={openAdd}>
            <IconPlus size={16} /> Add your first guest
          </button>
        </EmptyState>
      ) : (
        <>
          <div className="stat-row" style={{ marginBottom: "var(--sp-4)" }} data-tour="guests-stats">
            <div className="card stat">
              <div className="k">Guests</div>
              <div className="v">{statsGuests.length}</div>
            </div>
            <div className="card stat">
              <div className="k">Seated</div>
              <div className="v">{statSeated}</div>
            </div>
            <div className="card stat">
              <div className="k">Arrived</div>
              <div className="v">{statArrived}</div>
            </div>
            <div className="card stat">
              <div className="k">Need a seat</div>
              <div className="v" style={statNeedSeat > 0 ? { color: "var(--warn)" } : undefined}>{statNeedSeat}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: "var(--sp-4)", flexWrap: "wrap" }}>
            <div className="card" style={{ flex: "1 1 240px", padding: "var(--sp-2) var(--sp-4)" }}>
              <div className="searchbar">
                <IconSearch width={16} height={16} aria-hidden />
                <input
                  className="searchbar__input"
                  placeholder="Search guests or notes"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <button className="btn btn--primary btn--auto" data-tour="guests-add" onClick={openAdd}>
              <IconPlus size={16} /> Add Guest
            </button>
          </div>

          {sortedEvents.length > 1 && (
            <div className="field" data-tour="guests-filter">
              <div className="field__label">Filter by event</div>
              <ChipRow>
                <Chip active={eventFilter === ""} onClick={() => setEventFilter("")}>
                  All events <span className="chipcount">{guests.length}</span>
                </Chip>
                {sortedEvents.map((e) => {
                  const n = guestsByEvent.get(e.id)?.length ?? 0;
                  return (
                    <Chip key={e.id} active={eventFilter === e.id} onClick={() => setEventFilter(e.id)}>
                      {e.name || "Untitled event"}
                      {n > 0 && <span className="chipcount">{n}</span>}
                    </Chip>
                  );
                })}
              </ChipRow>
            </div>
          )}

          {renderedEvents.length === 0 ? (
            <div className="card" style={{ textAlign: "center" }}>
              <p className="muted" style={{ marginBottom: q ? 12 : 0 }}>
                {q ? "No guests match that search." : "No guests for this event."}
              </p>
              {q && (
                <button className="btn btn--ghost btn--auto" onClick={() => setSearch("")}>Clear search</button>
              )}
            </div>
          ) : (
            <div data-tour="guests-list">
              {renderedEvents.map((event) => (
                <GuestEventSection
                  key={event.id}
                  event={event}
                  guests={(guestsByEvent.get(event.id) ?? []).filter(matchesSearch)}
                  rooms={rooms.filter((r) => r.eventId === event.id)}
                  onOpenGuest={openEdit}
                  onAssignSeat={setAssignGuestId}
                  onToggleArrived={(g) => updateGuest(g.id, { arrived: !g.arrived })}
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

      <AssignSeatSheet
        open={!!assignGuestId}
        guest={assignGuest}
        rooms={assignRooms}
        eventGuests={assignEventGuests}
        onAssign={(roomId, seatIndex) => {
          if (!assignGuest) return;
          updateGuest(assignGuest.id, { roomId, seatIndex });
          const room = assignRooms.find((r) => r.id === roomId);
          showToast({ message: `${assignGuest.name || "Guest"} seated at ${room?.name ?? "table"}, seat ${seatIndex + 1}` });
          setAssignGuestId(null);
        }}
        onClose={() => setAssignGuestId(null)}
      />
    </div>
  );
}

function GuestEventSection({
  event,
  guests,
  rooms,
  onOpenGuest,
  onAssignSeat,
  onToggleArrived,
}: {
  event: EventItem;
  guests: Guest[];
  rooms: Room[];
  onOpenGuest: (id: string) => void;
  onAssignSeat: (id: string) => void;
  onToggleArrived: (guest: Guest) => void;
}) {
  const seated = guests.filter((g) => g.roomId).length;
  const seatedPct = guests.length ? pct(seated, guests.length) : 0;

  const tableGroups = rooms
    .map((room) => ({
      room,
      guests: guests.filter((g) => g.roomId === room.id).sort((a, b) => a.seatIndex - b.seatIndex),
    }))
    .filter((tg) => tg.guests.length > 0);

  const unseated = guests.filter((g) => !g.roomId);

  return (
    <section className="taskgroup">
      <div className="eventhead">
        <h2>{event.name || "Untitled event"}</h2>
        <span className="eventhead__count">
          {guests.length} guest{guests.length === 1 ? "" : "s"}
          {tableGroups.length > 0 ? ` · ${tableGroups.length} table${tableGroups.length === 1 ? "" : "s"}` : ""}
        </span>
        {guests.length > 0 && (
          <div className="eventhead__progress">
            <div className="eventhead__bar"><i style={{ width: `${seatedPct}%` }} /></div>
            {seated}/{guests.length} seated
          </div>
        )}
      </div>

      {tableGroups.map(({ room, guests: tableGuests }) => (
        <TableGroup key={room.id} room={room} guests={tableGuests} onOpenGuest={onOpenGuest} onToggleArrived={onToggleArrived} />
      ))}

      {unseated.length > 0 && (
        <div className="tablegroup tablegroup--unseated">
          <div className="tablegroup__head">
            <span className="tablegroup__name">Needs a seat</span>
            <span className="tablegroup__meta">{unseated.length} guest{unseated.length === 1 ? "" : "s"}</span>
            <span className="tablegroup__time">Action needed</span>
          </div>
          <div className="tablegroup__rows">
            {unseated.map((g) => (
              <div key={g.id} className="task">
                <Checkbox
                  checked={g.arrived}
                  onChange={() => onToggleArrived(g)}
                  label={g.arrived ? `Mark ${g.name || "guest"} as not arrived` : `Mark ${g.name || "guest"} as arrived`}
                />
                <button
                  className="guestrow__avatar"
                  style={{ background: hashColor(g.id, PICKABLE_CATEGORY_COLORS), border: "none", cursor: "pointer" }}
                  onClick={() => onOpenGuest(g.id)}
                  aria-label={`Edit ${g.name || "guest"}`}
                >
                  {initials(g.name)}
                </button>
                <button
                  className="task__body"
                  style={{ background: "none", border: "none", textAlign: "left", padding: 0, cursor: "pointer" }}
                  onClick={() => onOpenGuest(g.id)}
                >
                  <span className="task__title">{g.name || "Unnamed guest"}</span>
                  {g.notes && <span className="list__sub">{g.notes}</span>}
                </button>
                {g.arrived && (
                  <span className="pill" style={{ color: "var(--success)", background: "var(--success-soft)", flex: "none" }}>
                    Arrived
                  </span>
                )}
                <button className="btn btn--ghost btn--auto" style={{ flex: "none" }} onClick={() => onAssignSeat(g.id)}>
                  <IconSeat size={14} /> Assign seat
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {guests.length > 0 && (
        <div className="guestfoot">
          <span className="guestfoot__txt">
            <b>{seated} of {guests.length}</b> guests seated
          </span>
          <button
            className="btn btn--ghost btn--auto"
            style={{ marginLeft: "auto" }}
            onClick={() => navigate("seating", { id: event.id })}
          >
            Open seating
          </button>
        </div>
      )}
    </section>
  );
}

function TableGroup({
  room,
  guests,
  onOpenGuest,
  onToggleArrived,
}: {
  room: Room;
  guests: Guest[];
  onOpenGuest: (id: string) => void;
  onToggleArrived: (guest: Guest) => void;
}) {
  const times = Array.from(new Set(guests.map((g) => g.arrivalTime).filter(Boolean))).sort();
  const timeLabel =
    times.length === 0
      ? null
      : times.length === 1
        ? formatTimeOfDay(times[0])
        : `${formatTimeOfDay(times[0])}–${formatTimeOfDay(times[times.length - 1])}`;
  const statusLabel = guests.length >= room.seats ? `${room.seats} seats · full` : `${guests.length} of ${room.seats} seats`;

  return (
    <div className="tablegroup">
      <div className="tablegroup__head">
        <span className="tablegroup__name">{room.name || "Untitled table"}</span>
        <span className="tablegroup__meta">{statusLabel}</span>
        {timeLabel && <span className="tablegroup__time">Arrives {timeLabel}</span>}
      </div>
      <div className="tablegroup__rows">
        {guests.map((g) => (
          <div
            key={g.id}
            className="task"
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={() => onOpenGuest(g.id)}
            onKeyDown={onActivateKey(() => onOpenGuest(g.id))}
          >
            <span onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={g.arrived}
                onChange={() => onToggleArrived(g)}
                label={g.arrived ? `Mark ${g.name || "guest"} as not arrived` : `Mark ${g.name || "guest"} as arrived`}
              />
            </span>
            <span className="guestrow__avatar" style={{ background: hashColor(g.id, PICKABLE_CATEGORY_COLORS) }} aria-hidden>
              {initials(g.name)}
            </span>
            <span className="task__body">
              <span className="task__title">{g.name || "Unnamed guest"}</span>
              {g.notes && <span className="list__sub">{g.notes}</span>}
            </span>
            <span className="pill" style={{ background: "var(--surface-2)", color: "var(--muted)", flex: "none" }}>
              Seat {g.seatIndex + 1}
            </span>
            {g.arrived ? (
              <span className="pill" style={{ color: "var(--success)", background: "var(--success-soft)", flex: "none" }}>
                Arrived
              </span>
            ) : g.arrivalTime ? (
              <span className="pill" style={{ color: "var(--accent-text)", background: "var(--accent-soft)", flex: "none" }}>
                {formatTimeOfDay(g.arrivalTime)}
              </span>
            ) : (
              <span className="duelabel">No arrival</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Quick-assign an unseated guest to any empty seat, without leaving the page ----
function AssignSeatSheet({
  open,
  guest,
  rooms,
  eventGuests,
  onAssign,
  onClose,
}: {
  open: boolean;
  guest: Guest | null;
  rooms: Room[];
  eventGuests: Guest[];
  onAssign: (roomId: string, seatIndex: number) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={guest ? `Seat ${guest.name || "this guest"}` : "Seat guest"}>
      {rooms.length === 0 && (
        <p className="muted fs-13">No tables set up yet for this event — add one from Seating first.</p>
      )}
      {rooms.map((room) => {
        const occupied = new Set(eventGuests.filter((g) => g.roomId === room.id).map((g) => g.seatIndex));
        const empty = Array.from({ length: room.seats }, (_, i) => i).filter((i) => !occupied.has(i));
        return (
          <div key={room.id} style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 6 }}>{room.name || "Untitled table"}</div>
            {empty.length === 0 ? (
              <p className="muted fs-13">Full</p>
            ) : (
              <div className="chip-row">
                {empty.map((i) => (
                  <button key={i} className="chip" onClick={() => onAssign(room.id, i)}>
                    Seat {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </BottomSheet>
  );
}
