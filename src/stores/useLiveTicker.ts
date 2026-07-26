// Tiny UI-only store controlling whether the mobile LiveTicker is showing —
// same pattern as useCoachTourUi/useDemo, so the header's brand mark can
// toggle it directly without threading a prop down through App.tsx, and the
// ticker's own close button and the header's toggle both stay in sync.
import { create } from "zustand";

interface LiveTickerUiState {
  on: boolean;
  toggle: () => void;
  turnOff: () => void;
}

export const useLiveTicker = create<LiveTickerUiState>((set) => ({
  on: true,
  toggle: () => set((s) => ({ on: !s.on })),
  turnOff: () => set({ on: false }),
}));
