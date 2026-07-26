import { navigate } from "../../router";
import { IconChevronLeft } from "../../components/icons";
import { COPYRIGHT_HOLDER } from "../../lib/config";

export function PrivacyScreen() {
  return (
    <div>
      <button className="btn btn--ghost btn--auto" onClick={() => navigate("settings")} style={{ marginBottom: 16 }}>
        <IconChevronLeft size={16} /> Back
      </button>
      <h1 className="page-title">Privacy</h1>
      <p className="page-sub">How your data is stored and what this app can (and can't) see.</p>

      <div className="card">
        <div className="section-title">There is no server</div>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Event Planner is a static app with no backend of its own. Every event, task, and expense
          you enter is stored on this device (in your browser's local database) and, if you connect
          Google, mirrored to a Google Sheet that lives in <strong>your own</strong> Google Drive —
          never on a server we run.
        </p>
      </div>

      <div className="card">
        <div className="section-title">What Google access is requested</div>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Connecting Google requests exactly one scope: <code>drive.file</code>. That scope only
          lets this app see files it created itself (the one spreadsheet it makes for you) — it
          cannot browse, read, or modify anything else in your Drive. There is no calendar,
          contacts, or email access of any kind.
        </p>
      </div>

      <div className="card">
        <div className="section-title">Demo mode</div>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Sample events shown before you unlock the app with a purchase code live only in memory —
          they're never written to your device's storage and can never be pushed to a Sheet.
        </p>
      </div>

      <div className="card">
        <div className="section-title">Leaving</div>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Settings → Danger Zone lets you disconnect Google and erase everything stored on this
          device at any time. Disconnecting never deletes the Sheet itself — it stays in your
          Drive, under your control.
        </p>
      </div>

      <p className="muted fs-13" style={{ marginTop: 24 }}>© {new Date().getFullYear()} {COPYRIGHT_HOLDER}</p>
    </div>
  );
}
