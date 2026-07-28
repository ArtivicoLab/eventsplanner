import { useState } from "react";
import { navigate, useRoute } from "../router";
import { useSync } from "../stores/useSync";
import { useDemo } from "../lib/demo";
import { openCoachTour } from "../stores/useCoachTour";
import { useInstall, type InstallPlatform } from "../stores/useInstall";
import { IconCompass, IconSettings } from "./icons";
import { ROUTE_LABELS } from "../nav";
import { BottomSheet } from "./BottomSheet";

const LABEL: Record<string, string> = {
  synced: "Synced",
  syncing: "Syncing…",
  offline: "Offline",
};

const MANUAL_INSTALL_STEPS: Record<InstallPlatform, string> = {
  ios: "Tap the Share icon in Safari's toolbar, then choose \"Add to Home Screen\".",
  android: "Open your browser's menu (⋮) and tap \"Install app\" or \"Add to Home screen\".",
  desktop: "Look for the install icon in your browser's address bar, or open the browser menu and choose \"Install Event Planner\".",
};

export function Header() {
  const { status, pending, connected, needsReauth, busy, tapToRetry } = useSync();
  const demo = useDemo((s) => s.demo);
  const route = useRoute();
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

  const retryable = connected && !needsReauth && status === "offline";
  const clickable = needsReauth || retryable;
  const cls = needsReauth || status === "offline"
    ? "syncpill--off"
    : status === "synced" ? "syncpill--ok" : "syncpill--busy";
  const text = needsReauth
    ? "Tap to reconnect"
    : retryable
      ? "Offline · tap to retry"
      : status === "offline" && pending > 0
        ? `Offline · ${pending}`
        : !connected && status === "synced"
          ? "Saved"
          : LABEL[status];

  return (
    <header className="appbar">
      <span className="appbar__brand">
        <button className="appbar__brandbtn" aria-label="Install Event Planner" onClick={onBrandClick}>
          <img src="/favicon-96x96.png" alt="" aria-hidden width={22} height={22} className="appbar__brandimg" />
        </button>
        Event Planner
        {/* "Demo" badge temporarily disabled for Etsy listing screenshots — restore: demo && <span className="brand-demo" data-tour="demo-badge">Demo</span> */}
      </span>
      <span className="appbar__spacer" />
      {!demo && (clickable ? (
        <button
          className={`syncpill ${cls}`}
          disabled={busy}
          onClick={() => tapToRetry()}
          title={needsReauth ? "Your Google connection lapsed after being idle a while. Tap to sign in again, nothing was lost" : "Tap to retry syncing now"}
        >
          <span className="syncpill__dot" />
          {busy ? (needsReauth ? "Reconnecting…" : "Syncing…") : text}
        </button>
      ) : (
        <span className={`syncpill ${cls}`} title={connected ? "Synced to your Google Sheet" : "Stored on this device"}>
          <span className="syncpill__dot" />
          {text}
        </span>
      ))}
      <button
        className="chip"
        aria-label={`Coach Tour: ${ROUTE_LABELS[route]}`}
        title={`Coach Tour: ${ROUTE_LABELS[route]}`}
        onClick={openCoachTour}
        style={{ padding: 8, width: 34, height: 34, justifyContent: "center" }}
      >
        <IconCompass size={16} />
      </button>
      <button className="avatar" aria-label="Settings" title="Settings" data-tour="nav-settings" onClick={() => navigate("settings")}>
        <IconSettings size={16} />
      </button>
      <BottomSheet open={!!installNote} title="Install Event Planner" onClose={() => setInstallNote("")}>
        <p className="muted settings-sheet-note">{installNote}</p>
      </BottomSheet>
    </header>
  );
}
