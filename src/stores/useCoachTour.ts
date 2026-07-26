// Tiny UI-only store controlling whether the Coach Tour overlay is mounted —
// same pattern as useToast/useConfirm, so any screen can trigger it directly
// (openCoachTour()) without threading an onCoachTour prop down from App.tsx.
// CoachTour itself scopes its steps to whatever route is active at the
// moment it opens (see components/CoachTour.tsx), so the SAME trigger always
// launches the right screen's tour — no per-route wiring needed here.
import { create } from "zustand";

interface CoachTourUiState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useCoachTourUi = create<CoachTourUiState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

export function openCoachTour(): void {
  useCoachTourUi.getState().show();
}
