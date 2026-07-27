// Seating Chart — create rooms (tables/pods of seats), drag them into place on
// a floor-plan canvas, and place guests around the seats. The guest record is
// the only source of truth for occupancy (Guest.roomId/seatIndex); there's no
// separate "seat" entity to keep in sync, so assigning a guest to a seat that
// already has an occupant just moves that occupant's own record — no explicit
// "vacate" step needed anywhere (see lib/types.ts's Guest doc comment).
import { useEffect, useMemo, useRef, useState } from "react";
import { navigate, routeQuery } from "../../router";
import { useEvents } from "../../stores/useEvents";
import { useRooms } from "../../stores/useRooms";
import { useGuests } from "../../stores/useGuests";
import { confirmDialog } from "../../stores/useConfirm";
import { useToast } from "../../stores/useToast";
import { BottomSheet } from "../../components/BottomSheet";
import { EmptyState } from "../../components/EmptyState";
import { PageTourButton } from "../../components/PageTourButton";
import { Segmented } from "../../components/Segmented";
import {
  IconClose,
  IconEvents,
  IconPlus,
  IconSeat,
  IconTrash,
} from "../../components/icons";
import { seatPositions } from "../../lib/seating";
import { formatTimeOfDay } from "../../lib/dates";
import { hashColor, PICKABLE_CATEGORY_COLORS } from "../../lib/ui";
import type { Guest, Room, RoomShape } from "../../lib/types";

const DEFAULT_SEATS = 8;

// Cascades new rooms across the canvas instead of stacking them all on top
// of each other at a fixed default position. Only a 3x3 grid of spots fits
// the canvas before a cell has to be reused, so once every cell is taken
// (the 10th room onward) each full 3x3 cycle nudges by a growing offset —
// four distinct nudges before an exact repeat, instead of colliding again
// immediately on the very next room.
function nextRoomPosition(count: number): { x: number; y: number } {
  const cols = 3;
  const rows = 3;
  const cell = count % (cols * rows);
  const generation = Math.floor(count / (cols * rows));
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  const jitter = (generation % 4) * 3;
  return { x: 22 + col * 28 + jitter, y: 24 + row * 30 + jitter };
}

// ---- Preset layouts: pick one and the whole floor plan is placed for you ----
// Positions are percentages of the canvas, same coordinate space rooms use.
type LayoutKey = "banquet" | "classroom" | "ushape" | "headtable";

interface LayoutPreset {
  key: LayoutKey;
  label: string;
  description: string;
  shape: RoomShape;
  defaultTables: number;
  positions: (n: number) => { x: number; y: number; shape?: RoomShape; name?: string }[];
}

function gridPositions(n: number): { x: number; y: number }[] {
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  return Array.from({ length: n }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      x: cols === 1 ? 50 : 18 + (c * 64) / (cols - 1),
      y: rows === 1 ? 50 : 18 + (r * 64) / (rows - 1),
    };
  });
}

const LAYOUTS: LayoutPreset[] = [
  {
    key: "banquet",
    label: "Banquet",
    description: "Round tables in an even grid. Good for weddings, galas, and dinners.",
    shape: "round",
    defaultTables: 6,
    positions: gridPositions,
  },
  {
    key: "classroom",
    label: "Classroom",
    description: "Rows of rectangular tables all facing the front.",
    shape: "rectangle",
    defaultTables: 6,
    positions: (n) => {
      const cols = 2;
      const rows = Math.ceil(n / cols);
      return Array.from({ length: n }, (_, i) => ({
        x: i % cols === 0 ? 28 : 72,
        y: rows === 1 ? 50 : 20 + ((Math.floor(i / cols)) * 60) / (rows - 1),
      }));
    },
  },
  {
    key: "ushape",
    label: "U-Shape",
    description: "Tables around three sides. Good for meetings and workshops.",
    shape: "rectangle",
    defaultTables: 5,
    positions: (n) => {
      // Walk the U: down the left edge, across the bottom, up the right edge.
      const side = Math.ceil(n / 3);
      const bottom = n - side * 2 > 0 ? n - side * 2 : 0;
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i < side && out.length < n; i++) out.push({ x: 16, y: side === 1 ? 40 : 16 + (i * 56) / (side - 1) });
      for (let i = 0; i < bottom && out.length < n; i++) out.push({ x: bottom === 1 ? 50 : 30 + (i * 40) / (bottom - 1), y: 82 });
      for (let i = 0; i < side && out.length < n; i++) out.push({ x: 84, y: side === 1 ? 40 : 72 - (i * 56) / (side - 1) });
      return out;
    },
  },
  {
    key: "headtable",
    label: "Head Table + Rounds",
    description: "One long head table up front, round tables below.",
    shape: "round",
    defaultTables: 5,
    positions: (n) => {
      const rounds = Math.max(0, n - 1);
      const grid = gridPositions(rounds).map((p) => ({ ...p, y: 34 + p.y * 0.55 }));
      return [{ x: 50, y: 13, shape: "rectangle" as RoomShape, name: "Head Table" }, ...grid];
    },
  },
];

export function SeatingScreen() {
  const events = useEvents((s) => s.items);
  const { items: rooms, add: addRoom, update: updateRoom, remove: removeRoom } = useRooms();
  const { items: guests, add: addGuest, update: updateGuest, remove: removeGuest } = useGuests();
  const { show: showToast } = useToast();

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0)),
    [events]
  );

  // Seating is a standalone panel, not nested inside one event's page — a
  // link from Events/Event Detail can still preselect an event via ?id=, but
  // this screen owns its own selection afterward and lets you switch freely.
  const [eventId, setEventId] = useState(() => routeQuery().get("id") ?? "");
  useEffect(() => {
    const fromQuery = routeQuery().get("id");
    if (fromQuery) setEventId(fromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (eventId && !sortedEvents.some((e) => e.id === eventId)) setEventId("");
    if (!eventId && sortedEvents.length > 0) setEventId(sortedEvents[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedEvents]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ roomId: string; x: number; y: number } | null>(null);
  const [roomForm, setRoomForm] = useState<{ open: boolean; roomId: string | null }>({ open: false, roomId: null });
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [seatPicker, setSeatPicker] = useState<{ roomId: string; seatIndex: number } | null>(null);
  const [roomPicker, setRoomPicker] = useState<{ guestId: string } | null>(null);
  const [guestEditor, setGuestEditor] = useState<{ guestId: string } | null>(null);

  const event = events.find((e) => e.id === eventId) ?? null;
  const eventRooms = useMemo(() => rooms.filter((r) => r.eventId === eventId), [rooms, eventId]);
  const eventGuests = useMemo(() => guests.filter((g) => g.eventId === eventId), [guests, eventId]);
  const seatedGuests = eventGuests.filter((g) => g.roomId);

  // Every guest gets a stable per-event number (order they were added) — the
  // canvas shows just the number so seats stay clean and readable; the Guest
  // Key below maps each number back to a name. Derived, never stored: it can't
  // drift from the guest list, and removing a guest renumbers cleanly.
  const guestNumber = useMemo(() => {
    const ordered = [...eventGuests].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return new Map(ordered.map((g, i) => [g.id, i + 1]));
  }, [eventGuests]);

  function applyLayout(preset: LayoutPreset, tableCount: number, seatsPerTable: number) {
    void (async () => {
      if (eventRooms.length > 0) {
        const ok = await confirmDialog({
          title: "Replace the current floor plan?",
          message: "This removes the existing rooms. Guests go back to Unseated. They aren't removed.",
          confirmLabel: "Replace",
          danger: true,
        });
        if (!ok) return;
        for (const g of seatedGuests) updateGuest(g.id, { roomId: "", seatIndex: -1 });
        for (const r of eventRooms) removeRoom(r.id);
      }
      const spots = preset.positions(tableCount);
      let tableNo = 0;
      for (const p of spots) {
        addRoom({
          eventId,
          name: p.name ?? `Table ${++tableNo}`,
          shape: p.shape ?? preset.shape,
          seats: seatsPerTable,
          x: p.x,
          y: p.y,
        });
      }
      setLayoutOpen(false);
      showToast({ message: `${preset.label} layout placed. Drag any table to fine-tune.` });
    })();
  }

  function occupantOf(roomId: string, seatIndex: number): Guest | undefined {
    return eventGuests.find((g) => g.roomId === roomId && g.seatIndex === seatIndex);
  }

  // Shared by the live preview (onMove) and the committed position (onUp) —
  // they used to clamp Y to different ranges, so a table dragged near the
  // top/bottom edge would visibly snap ~2-4% the instant it was released.
  const ROOM_X_CLAMP: [number, number] = [6, 94];
  const ROOM_Y_CLAMP: [number, number] = [8, 92];

  function startDrag(room: Room, e: React.PointerEvent) {
    if (!canvasRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const originX = room.x;
    const originY = room.y;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    setDrag({ roomId: room.id, x: originX, y: originY });

    function onMove(ev: PointerEvent) {
      const dxPct = ((ev.clientX - startClientX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startClientY) / rect.height) * 100;
      setDrag({
        roomId: room.id,
        x: Math.max(ROOM_X_CLAMP[0], Math.min(ROOM_X_CLAMP[1], originX + dxPct)),
        y: Math.max(ROOM_Y_CLAMP[0], Math.min(ROOM_Y_CLAMP[1], originY + dyPct)),
      });
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrag(null);
      // Barely-moved pointer = a tap, not a drag — open the edit sheet
      // instead of "moving" the room a fraction of a percent. This is also
      // how edit/delete are reached now that there's no floating icon
      // overlay to fat-finger the seats around the table.
      if (Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) < 4) {
        setRoomForm({ open: true, roomId: room.id });
        return;
      }
      const dxPct = ((ev.clientX - startClientX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startClientY) / rect.height) * 100;
      updateRoom(room.id, {
        x: Math.max(ROOM_X_CLAMP[0], Math.min(ROOM_X_CLAMP[1], originX + dxPct)),
        y: Math.max(ROOM_Y_CLAMP[0], Math.min(ROOM_Y_CLAMP[1], originY + dyPct)),
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function deleteRoom(room: Room) {
    void (async () => {
      const ok = await confirmDialog({
        title: `Delete "${room.name}"?`,
        message: "Guests seated here go back to Unseated. They aren't removed.",
        confirmLabel: "Delete room",
        danger: true,
      });
      if (!ok) return;
      for (const g of eventGuests.filter((g) => g.roomId === room.id)) {
        updateGuest(g.id, { roomId: "", seatIndex: -1 });
      }
      removeRoom(room.id);
    })();
  }

  function assignGuestToSeat(guestId: string, roomId: string, seatIndex: number) {
    updateGuest(guestId, { roomId, seatIndex });
    setSeatPicker(null);
    setRoomPicker(null);
  }

  if (sortedEvents.length === 0) {
    return (
      <EmptyState icon={<IconEvents size={28} />} title="No events yet" sub="Add an event first, then come back here to plan its seating chart.">
        <button className="btn btn--primary btn--auto" onClick={() => navigate("events")}>
          Go to Events
        </button>
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <h1 className="page-title">Seating</h1>
        <PageTourButton />
      </div>
      <p className="page-sub">Plan tables and place guests, event by event.</p>

      <div className="field" data-tour="seating-event">
        <label className="field__label" htmlFor="seating-event">Event</label>
        <select id="seating-event" className="select" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {sortedEvents.map((e) => (
            <option key={e.id} value={e.id}>{e.name || "Untitled event"}</option>
          ))}
        </select>
      </div>

      {event && (
        <div className="spread" style={{ marginBottom: 16 }}>
          <p className="muted fs-13" style={{ margin: 0 }}>
            {eventGuests.length === 0
              ? "No guests yet"
              : `${seatedGuests.length}/${eventGuests.length} guests seated`}
            {eventRooms.length > 0 ? ` · ${eventRooms.length} ${eventRooms.length === 1 ? "room" : "rooms"}` : ""}
          </p>
          <button className="btn btn--ghost btn--auto" onClick={() => navigate("eventdetail", { id: event.id })}>
            View event
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <button className="btn btn--primary btn--auto" data-tour="seating-layout" onClick={() => setLayoutOpen(true)}>
          <IconSeat size={16} /> Choose Layout
        </button>
        <button className="btn btn--ghost btn--auto" onClick={() => setRoomForm({ open: true, roomId: null })}>
          <IconPlus size={16} /> Add Room
        </button>
        <button className="btn btn--ghost btn--auto" onClick={() => setAddGuestOpen(true)}>
          <IconPlus size={16} /> Add Guest
        </button>
      </div>

      {eventRooms.length === 0 ? (
        <EmptyState
          icon={<IconSeat size={28} />}
          title="No floor plan yet"
          sub="Pick a ready made layout and the tables and seats are placed for you, or add rooms one at a time."
        >
          <button className="btn btn--primary btn--auto" onClick={() => setLayoutOpen(true)}>
            <IconSeat size={16} /> Choose Layout
          </button>
        </EmptyState>
      ) : (
        <div className="seatcanvas__scroll">
          <div className="seatcanvas" data-tour="seating-canvas" ref={canvasRef}>
            {eventRooms.map((room) => {
              const live = drag && drag.roomId === room.id ? drag : room;
              const seats = seatPositions(room.shape, room.seats);
              const seatedHere = eventGuests.filter((g) => g.roomId === room.id).length;
              return (
                <div
                  key={room.id}
                  className={`seatroom seatroom--${room.shape}${drag?.roomId === room.id ? " seatroom--dragging" : ""}`}
                  style={{ left: `${live.x}%`, top: `${live.y}%` }}
                >
                  <div
                    className={`seatroom__shape seatroom__shape--${room.shape}`}
                    onPointerDown={(e) => startDrag(room, e)}
                  >
                    <span className="seatroom__name">{room.name || "Untitled room"}</span>
                    <span className="seatroom__count">{seatedHere}/{room.seats} seated</span>
                  </div>
                  {seats.map((pt, i) => {
                    const occupant = occupantOf(room.id, i);
                    return (
                      <button
                        key={i}
                        className={`seat ${occupant ? "seat--filled" : "seat--empty"}`}
                        style={{
                          left: `${pt.xPct}%`,
                          top: `${pt.yPct}%`,
                          background: occupant ? hashColor(occupant.id, PICKABLE_CATEGORY_COLORS) : undefined,
                        }}
                        title={occupant ? `${guestNumber.get(occupant.id)} · ${occupant.name}` : `Empty seat ${i + 1}`}
                        onClick={() =>
                          occupant ? setGuestEditor({ guestId: occupant.id }) : setSeatPicker({ roomId: room.id, seatIndex: i })
                        }
                      >
                        {occupant ? guestNumber.get(occupant.id) : <IconPlus size={13} />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="section-title" data-tour="seating-guests" style={{ marginTop: 24 }}>
        Guest Key {eventGuests.length > 0 ? `(${seatedGuests.length}/${eventGuests.length} seated)` : ""}
      </div>
      {eventGuests.length === 0 ? (
        <p className="muted fs-13">No guests added yet. Each guest gets a number, and that number is what shows on their seat.</p>
      ) : (
        <div className="guestlist">
          {[...eventGuests]
            .sort((a, b) => (guestNumber.get(a.id) ?? 0) - (guestNumber.get(b.id) ?? 0))
            .map((g) => {
              const room = eventRooms.find((r) => r.id === g.roomId);
              return (
                <div key={g.id} className="guestrow">
                  <button
                    className="guestrow__avatar"
                    style={{ background: hashColor(g.id, PICKABLE_CATEGORY_COLORS), border: "none" }}
                    onClick={() => setGuestEditor({ guestId: g.id })}
                    aria-label={`Edit ${g.name}`}
                  >
                    {guestNumber.get(g.id)}
                  </button>
                  <button
                    className="guestrow__body"
                    style={{ background: "none", border: "none", textAlign: "left", padding: 0 }}
                    onClick={() => setGuestEditor({ guestId: g.id })}
                  >
                    <div className="guestrow__name">{g.name || "Unnamed guest"}</div>
                    <div className="guestrow__meta">
                      {room ? `${room.name}, seat ${g.seatIndex + 1}` : "Unseated"}
                      {g.arrivalTime ? ` · Arriving ${formatTimeOfDay(g.arrivalTime)}` : ""}
                      {g.notes ? ` · ${g.notes}` : ""}
                    </div>
                  </button>
                  {!g.roomId && eventRooms.length > 0 && (
                    <button className="btn btn--ghost btn--auto" onClick={() => setRoomPicker({ guestId: g.id })}>
                      <IconSeat size={14} /> Seat
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      <RoomFormSheet
        open={roomForm.open}
        room={roomForm.roomId ? eventRooms.find((r) => r.id === roomForm.roomId) ?? null : null}
        existingCount={eventRooms.length}
        onSave={(patch, roomId) => {
          if (roomId) {
            const before = eventRooms.find((r) => r.id === roomId);
            updateRoom(roomId, patch);
            // Shrinking the seat count can orphan guests whose seatIndex no
            // longer exists in the room's own geometry — send them back to
            // Unseated instead of leaving them invisibly "seated" nowhere.
            if (before && patch.seats !== undefined && patch.seats < before.seats) {
              for (const g of eventGuests.filter((g) => g.roomId === roomId && g.seatIndex >= (patch.seats ?? 0))) {
                updateGuest(g.id, { roomId: "", seatIndex: -1 });
              }
            }
          } else {
            addRoom({ eventId, ...nextRoomPosition(eventRooms.length), ...patch });
          }
          setRoomForm({ open: false, roomId: null });
        }}
        onDelete={() => {
          const room = eventRooms.find((r) => r.id === roomForm.roomId);
          if (!room) return;
          setRoomForm({ open: false, roomId: null });
          deleteRoom(room);
        }}
        onClose={() => setRoomForm({ open: false, roomId: null })}
      />

      <GuestQuickAddSheet
        open={addGuestOpen}
        onSave={(name, arrivalTime, notes) => {
          addGuest({ eventId, name, roomId: "", seatIndex: -1, arrivalTime, notes });
          setAddGuestOpen(false);
          showToast({ message: `${name} added to guest list` });
        }}
        onClose={() => setAddGuestOpen(false)}
      />

      <LayoutSheet open={layoutOpen} onApply={applyLayout} onClose={() => setLayoutOpen(false)} />

      <SeatGuestPickerSheet
        open={!!seatPicker}
        eventRooms={eventRooms}
        eventGuests={eventGuests}
        guestNumber={guestNumber}
        target={seatPicker}
        onPick={(guestId) => seatPicker && assignGuestToSeat(guestId, seatPicker.roomId, seatPicker.seatIndex)}
        onCreateAndPick={(name) => {
          if (!seatPicker) return;
          const g = addGuest({ eventId, name, roomId: "", seatIndex: -1, notes: "" });
          assignGuestToSeat(g.id, seatPicker.roomId, seatPicker.seatIndex);
        }}
        onClose={() => setSeatPicker(null)}
      />

      <RoomSeatPickerSheet
        open={!!roomPicker}
        eventRooms={eventRooms}
        eventGuests={eventGuests}
        onPick={(roomId, seatIndex) => roomPicker && assignGuestToSeat(roomPicker.guestId, roomId, seatIndex)}
        onClose={() => setRoomPicker(null)}
      />

      <GuestEditorSheet
        open={!!guestEditor}
        guest={guestEditor ? eventGuests.find((g) => g.id === guestEditor.guestId) ?? null : null}
        roomName={
          guestEditor
            ? eventRooms.find((r) => r.id === eventGuests.find((g) => g.id === guestEditor.guestId)?.roomId)?.name
            : undefined
        }
        onSave={(patch) => guestEditor && updateGuest(guestEditor.guestId, patch)}
        onUnseat={() => guestEditor && updateGuest(guestEditor.guestId, { roomId: "", seatIndex: -1 })}
        onRemove={() => {
          void (async () => {
            if (!guestEditor) return;
            const g = eventGuests.find((x) => x.id === guestEditor.guestId);
            const ok = await confirmDialog({
              title: `Remove ${g?.name || "this guest"}?`,
              message: "This can't be undone.",
              confirmLabel: "Remove",
              danger: true,
            });
            if (!ok) return;
            removeGuest(guestEditor.guestId);
            setGuestEditor(null);
          })();
        }}
        onClose={() => setGuestEditor(null)}
      />
    </div>
  );
}

// ---- Pick a preset floor plan ----
function LayoutSheet({
  open,
  onApply,
  onClose,
}: {
  open: boolean;
  onApply: (preset: LayoutPreset, tableCount: number, seatsPerTable: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<LayoutKey>("banquet");
  const [tableCount, setTableCount] = useState(6);
  const [seatsPerTable, setSeatsPerTable] = useState(DEFAULT_SEATS);

  useMemo(() => {
    if (!open) return;
    setSelected("banquet");
    setTableCount(LAYOUTS[0].defaultTables);
    setSeatsPerTable(DEFAULT_SEATS);
  }, [open]);

  const preset = LAYOUTS.find((l) => l.key === selected)!;
  // Live mini preview of exactly what will be placed, using the same
  // position math as the real apply — what you see is what you get.
  const previewSpots = preset.positions(Math.max(1, tableCount));

  return (
    <BottomSheet open={open} onClose={onClose} title="Choose a layout">
      <div className="field">
        <label className="field__label">Arrangement</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {LAYOUTS.map((l) => (
            <button
              key={l.key}
              className="chip"
              aria-pressed={selected === l.key}
              onClick={() => {
                setSelected(l.key);
                setTableCount(l.defaultTables);
              }}
              style={{
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 3,
                padding: "10px 12px",
                borderRadius: 12,
                ...(selected === l.key ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" } : {}),
              }}
            >
              <span style={{ fontWeight: 800 }}>{l.label}</span>
              <span className="muted" style={{ fontSize: 11, whiteSpace: "normal", textAlign: "left" }}>{l.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: "relative",
          height: 120,
          borderRadius: 12,
          border: "1px dashed var(--hairline)",
          background: "var(--surface-2)",
          marginBottom: 16,
        }}
      >
        {previewSpots.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: "translate(-50%, -50%)",
              width: (p.shape ?? preset.shape) === "rectangle" ? 26 : 16,
              height: (p.shape ?? preset.shape) === "rectangle" ? 12 : 16,
              borderRadius: (p.shape ?? preset.shape) === "rectangle" ? 4 : "50%",
              background: "var(--accent)",
              opacity: 0.75,
            }}
          />
        ))}
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="layout-tables">Tables</label>
          <input
            id="layout-tables"
            type="number"
            min={1}
            max={12}
            className="input"
            value={tableCount}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setTableCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="layout-seats">Seats per table</label>
          <input
            id="layout-seats"
            type="number"
            min={1}
            max={24}
            className="input"
            value={seatsPerTable}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setSeatsPerTable(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      <button className="btn btn--primary" onClick={() => onApply(preset, tableCount, seatsPerTable)}>
        Place layout
      </button>
    </BottomSheet>
  );
}

// ---- Add / edit room ----
function RoomFormSheet({
  open,
  room,
  existingCount,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  room: Room | null;
  existingCount: number;
  onSave: (patch: { name: string; shape: RoomShape; seats: number }, roomId: string | null) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [shape, setShape] = useState<RoomShape>("round");
  const [seats, setSeats] = useState(DEFAULT_SEATS);

  useMemo(() => {
    if (!open) return;
    if (room) {
      setName(room.name);
      setShape(room.shape);
      setSeats(room.seats);
    } else {
      setName(`Table ${existingCount + 1}`);
      setShape("round");
      setSeats(DEFAULT_SEATS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, room?.id]);

  return (
    <BottomSheet open={open} onClose={onClose} title={room ? "Edit room" : "New room"}>
      <div className="field">
        <label className="field__label" htmlFor="room-name">Name</label>
        <input id="room-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label">Shape</label>
        <Segmented
          options={[
            { value: "round", label: "Round" },
            { value: "square", label: "Square" },
            { value: "rectangle", label: "Rectangle" },
          ]}
          value={shape}
          onChange={setShape}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="room-seats">Seats</label>
        <input
          id="room-seats"
          type="number"
          min={1}
          max={24}
          className="input"
          value={seats}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setSeats(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
        />
      </div>
      <button
        className={`btn btn--primary${room ? " btn--stack" : ""}`}
        disabled={!name.trim()}
        onClick={() => onSave({ name: name.trim(), shape, seats }, room?.id ?? null)}
      >
        {room ? "Save changes" : "Add room"}
      </button>
      {room && (
        <button className="btn btn--danger" onClick={onDelete}>
          <IconTrash size={15} /> Delete room
        </button>
      )}
    </BottomSheet>
  );
}

// ---- Quick-add a guest (unseated) ----
function GuestQuickAddSheet({
  open,
  onSave,
  onClose,
}: {
  open: boolean;
  onSave: (name: string, arrivalTime: string, notes: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [notes, setNotes] = useState("");

  useMemo(() => {
    if (!open) return;
    setName("");
    setArrivalTime("");
    setNotes("");
  }, [open]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Add guest">
      <div className="field">
        <label className="field__label" htmlFor="guest-name">Name</label>
        <input id="guest-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="guest-arrival">Arrival time</label>
        <input
          id="guest-arrival"
          type="time"
          className="input"
          value={arrivalTime}
          onChange={(e) => setArrivalTime(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="guest-notes">Notes</label>
        <input
          id="guest-notes"
          className="input"
          placeholder="Dietary restrictions, +1, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button
        className="btn btn--primary"
        disabled={!name.trim()}
        onClick={() => onSave(name.trim(), arrivalTime, notes.trim())}
      >
        Add guest
      </button>
    </BottomSheet>
  );
}

// ---- Pick a guest for a specific empty seat (also allows moving an already-seated guest) ----
function SeatGuestPickerSheet({
  open,
  eventRooms,
  eventGuests,
  guestNumber,
  target,
  onPick,
  onCreateAndPick,
  onClose,
}: {
  open: boolean;
  eventRooms: Room[];
  eventGuests: Guest[];
  guestNumber: Map<string, number>;
  target: { roomId: string; seatIndex: number } | null;
  onPick: (guestId: string) => void;
  onCreateAndPick: (name: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  useMemo(() => {
    if (!open) return;
    setNewName("");
  }, [open]);

  const room = target ? eventRooms.find((r) => r.id === target.roomId) : null;

  return (
    <BottomSheet open={open} onClose={onClose} title={room ? `Seat ${target!.seatIndex + 1} at ${room.name}` : "Pick a guest"}>
      <div className="field-row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label className="field__label" htmlFor="new-guest-name">New guest</label>
          <input
            id="new-guest-name"
            className="input"
            placeholder="Type a name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <button
          className="btn btn--primary btn--auto"
          disabled={!newName.trim()}
          onClick={() => onCreateAndPick(newName.trim())}
        >
          <IconPlus size={16} /> Seat
        </button>
      </div>

      <div className="guestlist" style={{ marginTop: 16 }}>
        {eventGuests.length === 0 && <p className="muted fs-13">No guests yet. Add one above.</p>}
        {eventGuests.map((g) => {
          const currentRoom = eventRooms.find((r) => r.id === g.roomId);
          return (
            <button
              key={g.id}
              className="guestrow"
              style={{ border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={() => onPick(g.id)}
            >
              <span className="guestrow__avatar" style={{ background: hashColor(g.id, PICKABLE_CATEGORY_COLORS) }}>
                {guestNumber.get(g.id)}
              </span>
              <span className="guestrow__body">
                <div className="guestrow__name">{g.name || "Unnamed guest"}</div>
                <div className="guestrow__meta">
                  {currentRoom ? `Currently at ${currentRoom.name}, seat ${g.seatIndex + 1}` : "Unseated"}
                </div>
              </span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

// ---- Pick an empty seat (any room) for a specific guest ----
function RoomSeatPickerSheet({
  open,
  eventRooms,
  eventGuests,
  onPick,
  onClose,
}: {
  open: boolean;
  eventRooms: Room[];
  eventGuests: Guest[];
  onPick: (roomId: string, seatIndex: number) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Pick a seat">
      {eventRooms.length === 0 && <p className="muted fs-13">Add a room first.</p>}
      {eventRooms.map((room) => {
        const occupied = new Set(eventGuests.filter((g) => g.roomId === room.id).map((g) => g.seatIndex));
        const empty = Array.from({ length: room.seats }, (_, i) => i).filter((i) => !occupied.has(i));
        return (
          <div key={room.id} style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 6 }}>{room.name}</div>
            {empty.length === 0 ? (
              <p className="muted fs-13">Full</p>
            ) : (
              <div className="chip-row">
                {empty.map((i) => (
                  <button key={i} className="chip" onClick={() => onPick(room.id, i)}>
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

// ---- View / edit a guest, unseat, or remove ----
function GuestEditorSheet({
  open,
  guest,
  roomName,
  onSave,
  onUnseat,
  onRemove,
  onClose,
}: {
  open: boolean;
  guest: Guest | null;
  roomName?: string;
  onSave: (patch: { name: string; arrivalTime: string; notes: string }) => void;
  onUnseat: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [notes, setNotes] = useState("");

  useMemo(() => {
    if (!open || !guest) return;
    setName(guest.name);
    setArrivalTime(guest.arrivalTime);
    setNotes(guest.notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guest?.id]);

  if (!guest) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title="Guest">
      {roomName && (
        <p className="muted fs-13" style={{ marginTop: 0 }}>
          Seated at {roomName}, seat {guest.seatIndex + 1}
        </p>
      )}
      <div className="field">
        <label className="field__label" htmlFor="edit-guest-name">Name</label>
        <input id="edit-guest-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="edit-guest-arrival">Arrival time</label>
        <input
          id="edit-guest-arrival"
          type="time"
          className="input"
          value={arrivalTime}
          onChange={(e) => setArrivalTime(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="edit-guest-notes">Notes</label>
        <input id="edit-guest-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button
        className="btn btn--primary btn--stack"
        disabled={!name.trim()}
        onClick={() => {
          onSave({ name: name.trim(), arrivalTime, notes: notes.trim() });
          onClose();
        }}
      >
        Save changes
      </button>
      {roomName && (
        <button className="btn btn--ghost btn--stack" onClick={() => { onUnseat(); onClose(); }}>
          <IconClose size={15} /> Unseat
        </button>
      )}
      <button className="btn btn--danger" onClick={onRemove}>
        <IconTrash size={15} /> Remove guest
      </button>
    </BottomSheet>
  );
}
