// Bottom tab bar (mobile). Fixed set of destinations — small enough that no
// pinning/rearranging is needed (unlike the sibling Life Planner app, which
// has 16+ possible destinations).
import { useState } from "react";
import { navigate, type Route } from "../router";
import { NAV } from "../nav";
import { useInstall, type InstallPlatform } from "../stores/useInstall";
import { BottomSheet } from "./BottomSheet";

const MANUAL_INSTALL_STEPS: Record<InstallPlatform, string> = {
  ios: "Tap the Share icon in Safari's toolbar, then choose \"Add to Home Screen\".",
  android: "Open your browser's menu (⋮) and tap \"Install app\" or \"Add to Home screen\".",
  desktop: "Look for the install icon in your browser's address bar, or open the browser menu and choose \"Install Event Planner\".",
};

export function TabBar({ active }: { active: Route }) {
  const { platform, installed, canPrompt, promptInstall } = useInstall();
  const [installNote, setInstallNote] = useState("");

  async function onBrandClick() {
    if (installed) {
      setInstallNote("Event Planner is already installed on this device.");
      return;
    }
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome !== "unavailable") return;
    }
    setInstallNote(MANUAL_INSTALL_STEPS[platform]);
  }

  return (
    <>
      <nav className="tabbar" aria-label="Primary">
        <button className="tabbar__brandbtn" aria-label="Install Event Planner" onClick={onBrandClick}>
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
      <BottomSheet open={!!installNote} title="Install Event Planner" onClose={() => setInstallNote("")}>
        <p className="muted settings-sheet-note">{installNote}</p>
      </BottomSheet>
    </>
  );
}
