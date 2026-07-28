// Bottom tab bar (mobile). Fixed set of destinations — small enough that no
// pinning/rearranging is needed (unlike the sibling Life Planner app, which
// has 16+ possible destinations).
import { navigate, type Route } from "../router";
import { NAV } from "../nav";
import { useLiveTicker } from "../stores/useLiveTicker";
import { useEvents } from "../stores/useEvents";
import { useEventTasks } from "../stores/useEventTasks";

// Same counts the desktop Sidebar shows next to Events/Tasks — kept in sync
// with Sidebar.tsx's own NAV_COUNT by hand, since each side owns its own
// small nav array rather than sharing one (NAV itself carries no count data).
const NAV_COUNT: Partial<Record<Route, (n: { events: number; tasks: number }) => number>> = {
  events: (n) => n.events,
  tasks: (n) => n.tasks,
};

export function TabBar({ active }: { active: Route }) {
  const liveOn = useLiveTicker((s) => s.on);
  const toggleLive = useLiveTicker((s) => s.toggle);
  const { items: events } = useEvents();
  const { items: tasks } = useEventTasks();
  const navCounts = { events: events.length, tasks: tasks.length };

  return (
    <nav className="tabbar" aria-label="Primary">
      <button
        className={`tabbar__brandbtn${liveOn ? "" : " tabbar__brandbtn--off"}`}
        onClick={toggleLive}
        aria-pressed={liveOn}
        aria-label={liveOn ? "Turn off live updates" : "Turn on live updates"}
        title={liveOn ? "Turn off live updates" : "Turn on live updates"}
      >
        <img src="/favicon-96x96.png" alt="" aria-hidden className="tabbar__brand" width={28} height={28} />
        <span>Live</span>
      </button>
      <div className="tabbar__scroll">
        {NAV.map(({ route, label, Icon }) => {
          const on = active === route;
          const count = NAV_COUNT[route]?.(navCounts);
          return (
            <button
              key={route}
              className={`tabbar__btn${on ? " tabbar__btn--active" : ""}`}
              aria-current={on ? "page" : undefined}
              data-tour={`nav-${route}`}
              onClick={() => navigate(route)}
            >
              <span className="tabbar__iconwrap">
                <Icon />
                {!!count && <span className="navbadge">{count}</span>}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
