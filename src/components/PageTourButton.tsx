// A small, explicit "take the tour for this screen" button meant to sit right
// next to a page's own <h1>. CoachTour always scopes itself to whatever route
// is active the moment it opens (see components/CoachTour.tsx), so this is
// safe to drop onto any screen unchanged — it never needs to know its own
// route name beyond the label shown here.
import { useRoute } from "../router";
import { ROUTE_LABELS } from "../nav";
import { openCoachTour } from "../stores/useCoachTour";
import { IconCompass } from "./icons";

export function PageTourButton() {
  const route = useRoute();
  return (
    <button
      className="tour-btn"
      onClick={openCoachTour}
      title={`Coach Tour: ${ROUTE_LABELS[route]}`}
    >
      <IconCompass size={15} /> Take the tour
    </button>
  );
}
