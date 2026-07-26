// Event Tracker: the filterable, searchable list of every event, styled as
// a grid of "invitation" cards (see first-love-events.html, the owner's
// reference mockup this screen is ported from).
import { useMemo, useState } from "react";
import { Chip, ChipRow } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { Icon, IconChevron, IconEdit, IconEvents, IconFilter, IconPlus, IconSearch, IconSeat } from "../../components/icons";
import { useEvents } from "../../stores/useEvents";
import { useSettings } from "../../stores/useSettings";
import { navigate } from "../../router";
import { dayNum, fromISO, format, todayISO } from "../../lib/dates";
import { categoryColor, eventStatusColor, money, PRIORITY_COLOR, PRIORITY_LABEL } from "../../lib/ui";
import { PRIORITIES, type EventItem, type Priority } from "../../lib/types";
import { EventSheet } from "./EventSheet";

function dateRangeLabel(ev: EventItem): string {
  const start = format(fromISO(ev.startDate), "MMM d");
  if (ev.startDate === ev.endDate) return start;
  const end = format(fromISO(ev.endDate), "MMM d");
  return `${start} to ${end}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toggleIn<T>(list: T[], value: T, setter: (v: T[]) => void) {
  setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
}

export function EventsScreen() {
  const { items: events } = useEvents();
  const settings = useSettings();

  const [search, setSearch] = useState("");
  const [selCategories, setSelCategories] = useState<string[]>([]);
  const [selStatuses, setSelStatuses] = useState<string[]>([]);
  const [selTypes, setSelTypes] = useState<string[]>([]);
  const [selPriorities, setSelPriorities] = useState<Priority[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  function openAdd() {
    setEditId(null);
    setSheetOpen(true);
  }
  function openEdit(id: string) {
    setEditId(id);
    setSheetOpen(true);
  }

  const sorted = useMemo(
    () => [...events].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0)),
    [events]
  );

  // Whatever event's own dates include today, regardless of the filters
  // below, since this is a quick "here's what's live right now" callout,
  // not part of the filtered browsing list.
  const nowEvent = useMemo(() => {
    const today = todayISO();
    return sorted.find((e) => e.startDate <= today && today <= e.endDate);
  }, [sorted]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (selCategories.length && !selCategories.includes(e.category)) return false;
      if (selStatuses.length && !selStatuses.includes(e.status)) return false;
      if (selTypes.length && !selTypes.includes(e.type)) return false;
      if (selPriorities.length && !selPriorities.includes(e.priority)) return false;
      return true;
    });
  }, [sorted, search, selCategories, selStatuses, selTypes, selPriorities]);

  const filtersActive =
    search.trim() !== "" ||
    selCategories.length > 0 ||
    selStatuses.length > 0 ||
    selTypes.length > 0 ||
    selPriorities.length > 0;

  function clearFilters() {
    setSearch("");
    setSelCategories([]);
    setSelStatuses([]);
    setSelTypes([]);
    setSelPriorities([]);
  }

  return (
    <div>
      <div className="spread" style={{ alignItems: "flex-end", marginBottom: "var(--sp-5)" }}>
        <div>
          <div className="page-title" style={{ marginBottom: 4 }}>Events</div>
          <div className="muted fs-13">{events.length} event{events.length === 1 ? "" : "s"}</div>
        </div>
        <button className="btn btn--primary btn--auto" data-tour="events-add" onClick={openAdd}>
          <IconPlus width={16} height={16} />
          Add Event
        </button>
      </div>

      <div className="card" data-tour="events-search" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="searchbar">
          <IconSearch width={16} height={16} aria-hidden />
          <input
            className="searchbar__input"
            placeholder="Search events"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-row">
          <span className="filter-lbl">Category</span>
          <ChipRow>
            {settings.categories.map((c) => (
              <Chip
                key={c}
                active={selCategories.includes(c)}
                dotColor={categoryColor(c)}
                onClick={() => toggleIn(selCategories, c, setSelCategories)}
              >
                {c}
              </Chip>
            ))}
          </ChipRow>
        </div>

        <div className="filter-row">
          <span className="filter-lbl">Status</span>
          <ChipRow>
            {settings.eventStatuses.map((s) => (
              <Chip
                key={s}
                active={selStatuses.includes(s)}
                dotColor={eventStatusColor(s)}
                onClick={() => toggleIn(selStatuses, s, setSelStatuses)}
              >
                {s}
              </Chip>
            ))}
          </ChipRow>
          <button className="more-filters-btn" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
            <IconFilter width={14} height={14} />
            More filters
            <IconChevron width={14} height={14} style={{ transform: moreOpen ? "rotate(90deg)" : "none", transition: "transform 200ms var(--ease)" }} />
          </button>
        </div>

        {moreOpen && (
          <>
            <div className="filter-row">
              <span className="filter-lbl">Type</span>
              <ChipRow>
                {settings.eventTypes.map((t) => (
                  <Chip key={t} active={selTypes.includes(t)} onClick={() => toggleIn(selTypes, t, setSelTypes)}>
                    {t}
                  </Chip>
                ))}
              </ChipRow>
            </div>
            <div className="filter-row">
              <span className="filter-lbl">Priority</span>
              <ChipRow>
                {PRIORITIES.map((p) => (
                  <Chip
                    key={p}
                    active={selPriorities.includes(p)}
                    dotColor={PRIORITY_COLOR[p]}
                    onClick={() => toggleIn(selPriorities, p, setSelPriorities)}
                  >
                    {PRIORITY_LABEL[p]}
                  </Chip>
                ))}
              </ChipRow>
            </div>
          </>
        )}
      </div>

      {nowEvent && (
        <div className="now" data-tour="events-now">
          <span className="now__pulse" aria-hidden />
          <span className="now__txt">
            <b>{nowEvent.name || "Untitled event"}</b> is happening now, {dateRangeLabel(nowEvent)}
          </span>
          <button className="now__go" onClick={() => navigate("eventdetail", { id: nowEvent.id })}>
            View event
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState
          icon={<IconEvents width={28} height={28} />}
          title="No events yet"
          sub="Add your first event to start tracking its tasks and budget."
        >
          <button className="btn btn--primary btn--auto" onClick={openAdd}>Add your first event</button>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted" style={{ marginBottom: filtersActive ? 12 : 0 }}>No events match these filters.</p>
          {filtersActive && (
            <button className="btn btn--ghost btn--auto" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      ) : (
        <div className="events-grid" data-tour="events-list">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} onEdit={() => openEdit(event.id)} />
          ))}
        </div>
      )}

      <EventSheet open={sheetOpen} eventId={editId} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

function EventCard({ event, onEdit }: { event: EventItem; onEdit: () => void }) {
  const settings = useSettings();
  const statusIcon = settings.eventStatusIcons[event.status] ?? "circle";
  const catColor = categoryColor(event.category);
  const statusColor = eventStatusColor(event.status);

  return (
    <article className="evcard">
      <div className="evcard__ribbon" style={{ background: `linear-gradient(90deg, ${catColor}, transparent 140%)` }} />
      <div className="evcard__body" onClick={() => navigate("eventdetail", { id: event.id })}>
        <div className="evcard__top">
          <span className="datechip" style={{ background: `color-mix(in srgb, ${catColor} 35%, var(--surface))` }}>
            <span className="datechip__m">{format(fromISO(event.startDate), "MMM")}</span>
            <span className="datechip__d">{dayNum(event.startDate)}</span>
          </span>
          <div className="evcard__titlewrap">
            <h2 className="evcard__title">{event.name || "Untitled event"}</h2>
            <div className="muted fs-13">{dateRangeLabel(event)}</div>
            <div className="evcard__cat">
              <span className="evcard__catdot" style={{ background: catColor }} />
              {event.category || "Uncategorized"}
            </div>
          </div>
          <div className="evcard__actions">
            <button
              className="icon-btn"
              aria-label={`Seating chart for ${event.name || "event"}`}
              title="Seating chart"
              onClick={(e) => {
                e.stopPropagation();
                navigate("seating", { id: event.id });
              }}
            >
              <IconSeat width={15} height={15} />
            </button>
            <button
              className="icon-btn"
              aria-label={`Edit ${event.name || "event"}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <IconEdit width={15} height={15} />
            </button>
          </div>
        </div>

        <div className="evcard__meta">
          <span className="pill" style={{ color: statusColor, background: `color-mix(in srgb, ${statusColor} 18%, var(--surface))` }}>
            <Icon name={statusIcon} width={11} height={11} />
            {event.status || "No status"}
          </span>
          <span className="dotchip">
            <span className="dotchip__dot" style={{ background: PRIORITY_COLOR[event.priority] }} />
            {PRIORITY_LABEL[event.priority]}
          </span>
        </div>

        <div className="evcard__foot">
          {event.owner && <span className="avatar" style={{ width: 26, height: 26, fontSize: 10.5 }}>{initials(event.owner)}</span>}
          <span className="muted fs-13">{event.owner ? <>Owner: <b className="txt-strong">{event.owner}</b></> : ""}</span>
          <span className="evcard__price">{money(event.budget, settings.currency)}</span>
        </div>
      </div>
    </article>
  );
}
