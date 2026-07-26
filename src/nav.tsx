// Single source of truth for navigation — consumed by the sidebar (desktop)
// and the bottom tab bar (mobile). Deliberately no "More" hub or pinning/
// rearranging like the sibling Life Planner app — this product only has a
// handful of destinations, so all of them fit directly in one bar.
import type { LucideIcon } from "lucide-react";
import type { Route } from "./router";
import { IconHome, IconCalendar, IconEvents, IconTasks, IconBudget, IconSeat, IconGuests, IconSettings } from "./components/icons";

export interface NavItem {
  route: Route;
  label: string;
  Icon: LucideIcon;
  color: string;
}

export const NAV: NavItem[] = [
  { route: "dashboard", label: "Dashboard", Icon: IconHome, color: "var(--cat-sky)" },
  { route: "calendar", label: "Calendar", Icon: IconCalendar, color: "var(--cat-sage)" },
  { route: "events", label: "Events", Icon: IconEvents, color: "var(--cat-rose)" },
  { route: "seating", label: "Seating", Icon: IconSeat, color: "var(--cat-teal)" },
  { route: "guests", label: "Guests", Icon: IconGuests, color: "var(--cat-berry)" },
  { route: "tasks", label: "Tasks", Icon: IconTasks, color: "var(--cat-marigold)" },
  { route: "budget", label: "Budget", Icon: IconBudget, color: "var(--cat-plum)" },
];

export const SETTINGS_ITEM: NavItem = {
  route: "settings",
  label: "Settings",
  Icon: IconSettings,
  color: "var(--muted)",
};

export const ROUTE_LABELS: Record<Route, string> = {
  dashboard: "Dashboard",
  calendar: "Calendar",
  events: "Events",
  eventdetail: "Event",
  seating: "Seating Chart",
  guests: "Guests",
  tasks: "Tasks",
  budget: "Budget",
  settings: "Settings",
  privacy: "Privacy",
};
