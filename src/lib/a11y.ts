import type { KeyboardEvent } from "react";

// WAI-ARIA APG "button" pattern: a role="button" element activates on both
// Enter and Space, not Enter alone. Guarded to e.target === e.currentTarget
// so a clickable row that also contains a real nested <button>/<a> (which
// already handles its own Enter/Space and stops propagation on click) doesn't
// double-fire when the key event bubbles up from that child.
export function onActivateKey(onActivate: () => void) {
  return (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
}
