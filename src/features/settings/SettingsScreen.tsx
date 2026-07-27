// Settings — Preferences, Quick Setup lists, Google Sheets connection, the
// Etsy access code gate, About, and the Danger Zone. The biggest single
// screen in the app; every field is wired straight to a store, no local
// draft state that could go stale.
import { useState } from "react";
import { Segmented } from "../../components/Segmented";
import { LockGatedButton } from "../../components/LockGatedButton";
import { Icon, IconClose, PICKABLE_ICON_NAMES } from "../../components/icons";
import { useSettings } from "../../stores/useSettings";
import { useSync } from "../../stores/useSync";
import { confirmDialog } from "../../stores/useConfirm";
import { useToast } from "../../stores/useToast";
import { activate, disconnectAndClearDevice, resetEverything, setDemoMode } from "../../stores/bootstrap";
import { useDemo } from "../../lib/demo";
import { navigate } from "../../router";
import { spreadsheetUrl } from "../../lib/google/sheets";
import { APP_VERSION, BUILD_SHA } from "../../lib/config";
import { categoryColor, PICKABLE_CATEGORY_COLORS } from "../../lib/ui";
import type { Settings } from "../../lib/types";

/** ms -> the coarsest sensible unit ("30s", "45m", "2h"). */
function formatWait(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.ceil(totalMinutes / 60);
  return `${totalHours}h`;
}

/**
 * An editable list of tags: existing entries as removable chips, plus a
 * text input + Add button (Enter also works) that appends a trimmed,
 * deduplicated, non-empty value. `renderPrefix` lets a caller (Categories,
 * Event Statuses) draw something clickable — a color dot, an icon — before
 * each chip's label.
 */
function TagListEditor({
  values,
  onChange,
  placeholder,
  renderPrefix,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  renderPrefix?: (name: string) => React.ReactNode;
}) {
  const [text, setText] = useState("");

  function add() {
    const v = text.trim();
    if (!v || values.includes(v)) {
      setText("");
      return;
    }
    onChange([...values, v]);
    setText("");
  }

  function remove(name: string) {
    onChange(values.filter((x) => x !== name));
  }

  return (
    <div>
      {values.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {values.map((v) => (
            <span key={v} className="chip">
              {renderPrefix?.(v)}
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => remove(v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <IconClose size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="spread spread--gap8">
        <input
          className="input"
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn--auto" disabled={!text.trim()} onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const {
    name,
    currency,
    weekStart,
    theme,
    categories,
    categoryColors,
    eventTypes,
    marketRegions,
    states,
    owners,
    eventStatuses,
    eventStatusIcons,
    expenseCategories,
    activated,
    update,
  } = useSettings();
  const {
    hasClientId,
    connected,
    spreadsheetId,
    busy,
    error,
    wrongAccount,
    connect,
    relink,
    disconnect,
    syncNow,
    useThisAccountInstead,
    startNewSheet,
  } = useSync();
  const { show } = useToast();
  const demo = useDemo((s) => s.demo);

  const [relinkOpen, setRelinkOpen] = useState(false);
  const [relinkValue, setRelinkValue] = useState("");
  const [categoryColorFor, setCategoryColorFor] = useState<string | null>(null);
  const [statusIconFor, setStatusIconFor] = useState<string | null>(null);
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [clearingDevice, setClearingDevice] = useState(false);
  const [togglingDemo, setTogglingDemo] = useState(false);

  async function toggleDemo() {
    setTogglingDemo(true);
    try {
      await setDemoMode(!demo);
      show({ message: demo ? "Showing your own data now." : "Previewing sample events. Nothing here is saved." });
    } finally {
      setTogglingDemo(false);
    }
  }

  async function submitRelink() {
    const value = relinkValue.trim();
    if (!value) return;
    const ok = await relink(value);
    if (ok) {
      setRelinkOpen(false);
      setRelinkValue("");
    }
  }

  async function handleStartNewSheet() {
    const ok = await confirmDialog({
      title: "Start a new sheet?",
      message:
        "This links a brand new, empty Google Sheet with the account you're signed in with and pushes everything on this device into it. Your old sheet isn't deleted, it just stays in your Drive, unlinked.",
      confirmLabel: "Start new sheet",
      danger: true,
    });
    if (ok) void startNewSheet();
  }

  async function submitAccessCode() {
    const code = accessCodeInput.trim();
    if (!code) return;
    const result = await activate(code);
    if (result.ok) {
      show({ message: "Unlocked! You can now connect Google Sheets." });
      setAccessCodeInput("");
    } else if (result.retryAfterMs) {
      show({ message: `Try again in ${formatWait(result.retryAfterMs)}.` });
    } else {
      show({ message: "That code isn't valid." });
    }
  }

  async function checkForUpdates() {
    setCheckingUpdate(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }
      show({ message: "Checked for updates." });
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleStartOver() {
    const ok = await confirmDialog({
      title: "Erase everything?",
      message:
        "This deletes every event, task, expense, seating chart, and guest on this device. This can't be undone." +
        " Your Quick Setup lists and access code are kept.",
      confirmLabel: "Erase everything",
      danger: true,
    });
    if (!ok) return;
    await resetEverything();
    show({ message: "Everything on this device was erased." });
    navigate("dashboard");
  }

  async function handleDisconnectClear() {
    setClearingDevice(true);
    try {
      const result = await disconnectAndClearDevice();
      if (!result.ok) {
        show({ message: `Nothing was cleared: ${result.reason}` });
        return;
      }
      show({ message: "Disconnected and cleared this device." });
      navigate("dashboard");
    } finally {
      setClearingDevice(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Make Event Planner yours.</p>

      {/* ---------- 1. Account & Sync (access code + Google Sheets, merged) ---------- */}
      <div className="section-title">Account &amp; Sync</div>
      <div className="card" data-tour="settings-sheets">
        <div className="srow">
          <div className="srow__info">
            <div className="srow__label">Access code</div>
            <div className="srow__hint">Your license for this device.</div>
          </div>
          <div className="srow__control">
            {activated ? (
              <span className="status-pill status-pill--ok">Activated</span>
            ) : (
              <div className="spread spread--gap8">
                <input
                  className="input"
                  value={accessCodeInput}
                  placeholder="Access code"
                  aria-label="Access code"
                  onChange={(e) => setAccessCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submitAccessCode()}
                />
                <button className="btn btn--auto" disabled={!accessCodeInput.trim()} onClick={() => void submitAccessCode()}>
                  Unlock
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="srow">
          <div className="srow__info">
            <div className="srow__label">Google Sheets</div>
            <div className="srow__hint">
              {!hasClientId
                ? "Not set up in this build yet — everything still works fully offline."
                : connected
                  ? "Connected. Your data lives in your own Google Drive."
                  : "Connect to back up your data and sync it across devices."}
            </div>
          </div>
          <div className="srow__control">
            {!hasClientId ? (
              <button className="btn btn--primary btn--auto" disabled>
                Connect Google
              </button>
            ) : connected ? (
              <>
                <a className="btn btn--ghost btn--auto" href={spreadsheetUrl(spreadsheetId)} target="_blank" rel="noreferrer">
                  Open my sheet
                </a>
                <button className="btn btn--primary btn--auto" disabled={busy} onClick={() => void syncNow(true)}>
                  {busy ? "Syncing…" : "Sync now"}
                </button>
                <button className="btn btn--ghost btn--auto" onClick={() => disconnect()}>
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <button className="btn btn--primary btn--auto" disabled={busy} onClick={() => void connect()}>
                  {busy ? "Connecting…" : "Connect Google"}
                </button>
                <button className="btn btn--ghost btn--auto" onClick={() => setRelinkOpen((v) => !v)}>
                  Already have a sheet?
                </button>
              </>
            )}
          </div>
        </div>

        {hasClientId && !connected && relinkOpen && (
          <div className="srow__extra field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="set-relink">
              Sheet link or ID
            </label>
            <div className="spread spread--gap8">
              <input
                id="set-relink"
                className="input"
                value={relinkValue}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                onChange={(e) => setRelinkValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submitRelink()}
              />
              <button className="btn btn--auto" disabled={busy || !relinkValue.trim()} onClick={() => void submitRelink()}>
                {busy ? "Linking…" : "Link this sheet"}
              </button>
            </div>
          </div>
        )}

        {wrongAccount && (
          <div className="srow__extra">
            <p className="fs-13" style={{ color: "var(--alert)" }}>
              {error || "This Google account doesn't have access to your existing sheet."}
            </p>
            <div className="spread spread--gap8" style={{ marginTop: 8 }}>
              <button className="btn btn--auto" disabled={busy} onClick={() => void useThisAccountInstead()}>
                Try a different account
              </button>
              <button className="btn btn--auto btn--ghost" disabled={busy} onClick={() => void handleStartNewSheet()}>
                Start a new sheet with this account
              </button>
            </div>
          </div>
        )}
        {!wrongAccount && error && (
          <p className="srow__extra fs-13" style={{ color: "var(--alert)" }}>
            {error}
          </p>
        )}
      </div>

      {/* ---------- 2. Preferences ---------- */}
      <div className="section-title">Preferences</div>
      <div className="card">
        <div className="srow">
          <div className="srow__info">
            <div className="srow__label">Your name</div>
            <div className="srow__hint">Used in greetings around the app. Optional.</div>
          </div>
          <div className="srow__control">
            <input
              id="set-name"
              className="input"
              value={name}
              maxLength={40}
              placeholder="Your name"
              aria-label="Your name"
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
        </div>
        <div className="srow">
          <div className="srow__info">
            <div className="srow__label">Currency</div>
            <div className="srow__hint">Symbol shown on budgets and expenses.</div>
          </div>
          <div className="srow__control">
            <input
              id="set-currency"
              className="input"
              style={{ width: 80, textAlign: "center" }}
              value={currency}
              maxLength={4}
              aria-label="Currency"
              onChange={(e) => update({ currency: e.target.value })}
            />
          </div>
        </div>
        <div className="srow">
          <div className="srow__info">
            <div className="srow__label">Week starts on</div>
          </div>
          <div className="srow__control">
            <Segmented
              options={[
                { value: "0", label: "Sunday" },
                { value: "1", label: "Monday" },
              ]}
              value={String(weekStart)}
              onChange={(v) => update({ weekStart: Number(v) as 0 | 1 })}
            />
          </div>
        </div>
        <div className="srow">
          <div className="srow__info">
            <div className="srow__label">Theme</div>
          </div>
          <div className="srow__control">
            <Segmented
              options={[
                { value: "auto", label: "Auto" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={theme}
              onChange={(v) => update({ theme: v as Settings["theme"] })}
            />
          </div>
        </div>
      </div>

      {/* ---------- 3. Demo Mode ---------- */}
      <div className="section-title">Demo Mode</div>
      <div className="card" data-tour="settings-demo">
        <div className="srow">
          <div className="srow__info">
            <div className="srow__label">Sample events</div>
            <div className="srow__hint">
              {demo
                ? "You are looking at sample events right now. Nothing you add or change here is saved."
                : "You are looking at your own data. Switch to sample events any time to see what a fully populated planner looks like, then switch back with nothing lost."}
            </div>
          </div>
          <div className="srow__control">
            <button className="btn btn--ghost btn--auto" disabled={togglingDemo} onClick={() => void toggleDemo()}>
              {togglingDemo ? "Switching…" : demo ? "Switch to my data" : "Preview sample events"}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- 4. Lists & Labels ---------- */}
      <div className="section-title">Lists &amp; Labels</div>
      <div className="card" data-tour="settings-setup">
        <div className="taxblock">
          <div className="taxhead">
            <span className="taxhead__label">Categories</span>
            <span className="taxhead__count">{categories.length}</span>
            <span className="taxhead__hint">Used to color-code events</span>
          </div>
          <TagListEditor
            values={categories}
            onChange={(next) => update({ categories: next })}
            placeholder="Add a category"
            renderPrefix={(cName) => (
              <button
                type="button"
                className="dot-9"
                aria-label={`Change color for ${cName}`}
                onClick={() => setCategoryColorFor((cur) => (cur === cName ? null : cName))}
                style={{ background: categoryColor(cName), border: "none", padding: 0, cursor: "pointer" }}
              />
            )}
          />
          {categoryColorFor && categories.includes(categoryColorFor) && (
            <div className="chip-row" style={{ margin: "10px 0 0" }}>
              {PICKABLE_CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use this color for ${categoryColorFor}`}
                  onClick={() => {
                    update({ categoryColors: { ...categoryColors, [categoryColorFor]: c } });
                    setCategoryColorFor(null);
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: c,
                    border: c === categoryColors[categoryColorFor] ? "2px solid var(--ink)" : "1px solid var(--hairline)",
                    padding: 0,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="taxblock">
          <div className="taxhead">
            <span className="taxhead__label">Event Types</span>
            <span className="taxhead__count">{eventTypes.length}</span>
          </div>
          <TagListEditor
            values={eventTypes}
            onChange={(next) => update({ eventTypes: next })}
            placeholder="Add an event type"
          />
        </div>

        <div className="taxblock">
          <div className="taxhead">
            <span className="taxhead__label">Market / Regions</span>
            <span className="taxhead__count">{marketRegions.length}</span>
          </div>
          <TagListEditor
            values={marketRegions}
            onChange={(next) => update({ marketRegions: next })}
            placeholder="Add a market or region"
          />
        </div>

        <div className="taxblock">
          <div className="taxhead">
            <span className="taxhead__label">States</span>
            <span className="taxhead__count">{states.length}</span>
          </div>
          <TagListEditor values={states} onChange={(next) => update({ states: next })} placeholder="Add a state" />
        </div>

        <div className="taxblock">
          <div className="taxhead">
            <span className="taxhead__label">Owners</span>
            <span className="taxhead__count">{owners.length}</span>
            <span className="taxhead__hint">Fills "Owner" on Events, "Assigned To" on Tasks</span>
          </div>
          <TagListEditor values={owners} onChange={(next) => update({ owners: next })} placeholder="Add an owner" />
        </div>

        <div className="taxblock">
          <div className="taxhead">
            <span className="taxhead__label">Event Statuses</span>
            <span className="taxhead__count">{eventStatuses.length}</span>
          </div>
          <TagListEditor
            values={eventStatuses}
            onChange={(next) => update({ eventStatuses: next })}
            placeholder="Add a status"
            renderPrefix={(sName) => (
              <button
                type="button"
                aria-label={`Change icon for ${sName}`}
                onClick={() => setStatusIconFor((cur) => (cur === sName ? null : sName))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <Icon name={eventStatusIcons[sName] ?? "circle"} size={14} />
              </button>
            )}
          />
          {statusIconFor && eventStatuses.includes(statusIconFor) && (
            <div className="chip-row" style={{ margin: "10px 0 0" }}>
              {PICKABLE_ICON_NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Use the ${n} icon for ${statusIconFor}`}
                  onClick={() => {
                    update({ eventStatusIcons: { ...eventStatusIcons, [statusIconFor]: n } });
                    setStatusIconFor(null);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    background: n === eventStatusIcons[statusIconFor] ? "var(--accent-soft)" : "var(--surface-2)",
                    color: "var(--ink)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon name={n} size={15} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="taxblock">
          <div className="taxhead">
            <span className="taxhead__label">Expense Categories</span>
            <span className="taxhead__count">{expenseCategories.length}</span>
            <span className="taxhead__hint">Feeds the Category picker on Budget</span>
          </div>
          <TagListEditor
            values={expenseCategories}
            onChange={(next) => update({ expenseCategories: next })}
            placeholder="Add an expense category"
          />
        </div>
      </div>

      {/* ---------- 5. About ---------- */}
      <div className="section-title">About</div>
      <div className="about-line">
        <span>
          <b>Event Planner</b> v{APP_VERSION}
          {BUILD_SHA && ` · ${BUILD_SHA}`}
        </span>
        <span className="about-line__sep">·</span>
        <button type="button" disabled={checkingUpdate} onClick={() => void checkForUpdates()}>
          {checkingUpdate ? "Checking…" : "Check for updates"}
        </button>
        <span className="about-line__sep">·</span>
        <button type="button" onClick={() => navigate("privacy")}>
          Privacy
        </button>
      </div>

      {/* ---------- 6. Danger Zone ---------- */}
      <div className="section-title" style={{ color: "var(--alert)", marginTop: 28 }}>
        Danger Zone
      </div>
      <div className="danger-card" data-tour="settings-danger" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div className="fs-13" style={{ fontWeight: 700, marginBottom: 4 }}>
            Start over
          </div>
          <p className="muted fs-13 mb-1">
            Erase every event, task, expense, seating chart, and guest on this device. This can't be undone.
          </p>
          <LockGatedButton label="Start over" danger onConfirm={() => void handleStartOver()} />
        </div>
        {connected && (
          <div>
            <div className="fs-13" style={{ fontWeight: 700, marginBottom: 4 }}>
              Disconnect and clear this device
            </div>
            <p className="muted fs-13 mb-1">
              Push any last changes to your Sheet, then remove your data from this device only. Your Sheet keeps
              everything.
            </p>
            <LockGatedButton
              label="Disconnect and clear this device"
              danger
              busy={clearingDevice}
              busyLabel="Clearing…"
              onConfirm={() => void handleDisconnectClear()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
