import { useEffect, useState } from "react";
import { useRoute } from "./router";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { Sidebar } from "./components/Sidebar";
import { DemoBanner } from "./components/DemoBanner";
import { ReconnectBanner } from "./components/ReconnectBanner";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { Toaster } from "./components/Toast";
import { ConfirmHost } from "./components/ConfirmDialog";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { CalendarScreen } from "./features/calendar/CalendarScreen";
import { EventsScreen } from "./features/events/EventsScreen";
import { EventDetailScreen } from "./features/events/EventDetailScreen";
import { SeatingScreen } from "./features/seating/SeatingScreen";
import { GuestsScreen } from "./features/guests/GuestsScreen";
import { TasksScreen } from "./features/tasks/TasksScreen";
import { BudgetScreen } from "./features/budget/BudgetScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { PrivacyScreen } from "./features/privacy/PrivacyScreen";
import { CoachTour, hasSeenTour } from "./components/CoachTour";
import { useCoachTourUi, openCoachTour } from "./stores/useCoachTour";
import { bootstrap } from "./stores/bootstrap";
import { preloadGis } from "./lib/google/auth";

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);
  const showTour = useCoachTourUi((s) => s.open);
  const hideTour = useCoachTourUi((s) => s.hide);

  useEffect(() => {
    bootstrap().then(() => {
      setReady(true);
      if (!hasSeenTour()) openCoachTour();
    });
    preloadGis();
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <div className="muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className={`app${route === "dashboard" ? " app--dashboard" : ""}`}>
      <Sidebar active={route} />
      <div className="app__col">
        <Header />
        <DemoBanner />
        <ReconnectBanner />
        <main
          className={`app__main${route === "dashboard" || route === "calendar" || route === "seating" ? " app__main--wide" : ""}`}
          key={route}
        >
          {route === "dashboard" && <DashboardScreen />}
          {route === "calendar" && <CalendarScreen />}
          {route === "events" && <EventsScreen />}
          {route === "eventdetail" && <EventDetailScreen />}
          {route === "seating" && <SeatingScreen />}
          {route === "guests" && <GuestsScreen />}
          {route === "tasks" && <TasksScreen />}
          {route === "budget" && <BudgetScreen />}
          {route === "settings" && <SettingsScreen />}
          {route === "privacy" && <PrivacyScreen />}
        </main>
      </div>
      <TabBar active={route} />
      <UpdatePrompt />
      <Toaster />
      <ConfirmHost />
      {showTour && <CoachTour onDone={hideTour} />}
    </div>
  );
}
