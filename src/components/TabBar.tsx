// Bottom tab bar (mobile). Fixed set of destinations — small enough that no
// pinning/rearranging is needed (unlike the sibling Life Planner app, which
// has 16+ possible destinations).
import { navigate, type Route } from "../router";
import { NAV } from "../nav";
import { useLiveTicker } from "../stores/useLiveTicker";

export function TabBar({ active }: { active: Route }) {
  const liveOn = useLiveTicker((s) => s.on);
  const toggleLive = useLiveTicker((s) => s.toggle);

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
      </button>
      <div className="tabbar__scroll">
        {NAV.map(({ route, label, Icon }) => {
          const on = active === route;
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
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
