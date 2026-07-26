// Tiny hash router — no react-router needed for this few routes.
import { useEffect, useState } from "react";

export type Route =
  | "dashboard"
  | "calendar"
  | "events"
  | "eventdetail"
  | "seating"
  | "guests"
  | "tasks"
  | "budget"
  | "settings"
  | "privacy";

const ROUTES: Route[] = [
  "dashboard",
  "calendar",
  "events",
  "eventdetail",
  "seating",
  "guests",
  "tasks",
  "budget",
  "settings",
  "privacy",
];

export function currentRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  const r = h.split("?")[0] as Route;
  return ROUTES.includes(r) ? r : "dashboard";
}

export function navigate(route: Route, query?: Record<string, string>) {
  const q = query ? "?" + new URLSearchParams(query).toString() : "";
  window.location.hash = `#/${route}${q}`;
}

export function routeQuery(): URLSearchParams {
  const h = window.location.hash;
  const qi = h.indexOf("?");
  return new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : "");
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute());
  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) navigate("dashboard");
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}
