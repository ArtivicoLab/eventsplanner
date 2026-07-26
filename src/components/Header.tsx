import { navigate, useRoute } from "../router";
import { useSync } from "../stores/useSync";
import { useDemo } from "../lib/demo";
import { openCoachTour } from "../stores/useCoachTour";
import { useLiveTicker } from "../stores/useLiveTicker";
import { IconCompass } from "./icons";
import { ROUTE_LABELS } from "../nav";

const LABEL: Record<string, string> = {
  synced: "Synced",
  syncing: "Syncing…",
  offline: "Offline",
};

export function Header() {
  const { status, pending, connected, needsReauth, busy, tapToRetry } = useSync();
  const demo = useDemo((s) => s.demo);
  const route = useRoute();
  const liveOn = useLiveTicker((s) => s.on);
  const toggleLive = useLiveTicker((s) => s.toggle);
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
        <button
          className={`appbar__brandbtn${liveOn ? "" : " appbar__brandbtn--off"}`}
          onClick={toggleLive}
          aria-pressed={liveOn}
          aria-label={liveOn ? "Turn off live updates" : "Turn on live updates"}
          title={liveOn ? "Turn off live updates" : "Turn on live updates"}
        >
          <img src="/favicon-96x96.png" alt="" aria-hidden width={22} height={22} className="appbar__brandimg" />
        </button>
        Event Planner
        {demo && <span className="brand-demo" data-tour="demo-badge">Demo</span>}
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
      <button className="avatar" aria-label="Settings" data-tour="nav-settings" onClick={() => navigate("settings")}>
        EP
      </button>
    </header>
  );
}
