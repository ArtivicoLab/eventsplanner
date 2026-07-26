import { create } from "zustand";
import { hasClientId } from "../lib/google/auth";
import * as sync from "../lib/sync";
import { useToast } from "./useToast";
import type { Collection } from "../lib/db";

export type SyncStatus = "synced" | "syncing" | "offline";

interface SyncState {
  status: SyncStatus;
  pending: number;
  connected: boolean;
  spreadsheetId: string;
  /** The most recently ABANDONED sheet's id, if any — for a "your previous
      sheet is still here" link in Settings, never used to reconnect automatically. */
  previousSpreadsheetId: string;
  hasClientId: boolean;
  busy: boolean;
  error: string;
  /** True when the last connect() failed because the signed-in Google account
      doesn't own the remembered sheet (picked the wrong account, or a genuine
      switch). Settings shows a specific "try a different account" / "start a
      new sheet with this account" choice instead of the raw API error text. */
  wrongAccount: boolean;
  /** True when a background sync attempt found the Google token expired and a
      silent refresh failed. Background code deliberately never opens a popup
      to fix this itself; the UI shows a "tap to reconnect" affordance instead. */
  needsReauth: boolean;

  setStatus: (s: SyncStatus) => void;
  /** Called after every mutation; debounced push to Sheets when connected.
      Pass the collection that changed so only its tab gets pushed (falls
      back to a full push if omitted). */
  touch: (collection?: Collection) => void;

  connect: () => Promise<void>;
  relink: (idOrUrl: string) => Promise<boolean>;
  disconnect: () => void;
  syncNow: (allowInteractive?: boolean) => Promise<void>;
  useThisAccountInstead: () => Promise<void>;
  startNewSheet: () => Promise<void>;
  /** What the sync pill's click calls, in Header AND Sidebar — centralized so
      a failure (e.g. a blocked popup) surfaces as a toast right where the
      user clicked. */
  tapToRetry: () => Promise<void>;
}

let flashTimer: ReturnType<typeof setTimeout> | null = null;

function flagNeedsReauth(_get: () => SyncState, set: (p: Partial<SyncState>) => void) {
  set({ needsReauth: true });
}

export const useSync = create<SyncState>((set, get) => ({
  status: navigator.onLine ? (sync.hasPendingPush() ? "syncing" : "synced") : "offline",
  pending: 0,
  connected: sync.isConnected(),
  spreadsheetId: sync.getSpreadsheetId(),
  previousSpreadsheetId: sync.getPreviousSpreadsheetId(),
  hasClientId,
  busy: false,
  error: "",
  wrongAccount: false,
  needsReauth: false,

  setStatus: (status) => set({ status }),

  touch: (collection) => {
    if (get().connected) {
      sync.markDirty(collection ? sync.COLLECTION_TAB[collection] : undefined);
      sync.scheduleFlush(
        (s) => set({ status: s }),
        () => flagNeedsReauth(get, set)
      );
      return;
    }
    if (!navigator.onLine) {
      set((s) => ({ status: "offline", pending: s.pending + 1 }));
      return;
    }
    set({ status: "syncing" });
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => set({ status: "synced", pending: 0 }), 400);
  },

  connect: async () => {
    set({ busy: true, error: "", wrongAccount: false, status: "syncing" });
    try {
      const id = await sync.connect();
      set({
        connected: true,
        spreadsheetId: id,
        busy: false,
        wrongAccount: false,
        needsReauth: false,
        status: "synced",
      });
    } catch (e) {
      const wrongAccount = e instanceof sync.SheetPermissionDeniedError;
      set({
        busy: false,
        wrongAccount,
        status: get().connected ? "synced" : "offline",
        error: wrongAccount
          ? "This Google account doesn't have access to your existing Event Planner sheet."
          : e instanceof Error ? e.message : "Could not connect.",
      });
    }
  },

  relink: async (idOrUrl) => {
    set({ busy: true, error: "", status: "syncing" });
    try {
      await sync.relink(idOrUrl);
      set({
        connected: true,
        spreadsheetId: sync.getSpreadsheetId(),
        busy: false,
        status: "synced",
      });
      return true;
    } catch (e) {
      set({
        busy: false,
        status: get().connected ? "synced" : "offline",
        error: e instanceof Error ? e.message : "Could not link that sheet.",
      });
      return false;
    }
  },

  disconnect: () => {
    sync.disconnect();
    // spreadsheetId is deliberately left in place — sync.disconnect() keeps
    // the sheet remembered so the next connect() relinks to it instead of
    // creating a new one.
    set({ connected: false, error: "", needsReauth: false });
  },

  syncNow: async (allowInteractive = true) => {
    if (!get().connected) return;
    set({ busy: true, status: "syncing", error: "" });
    try {
      await sync.pushAll(allowInteractive);
      set({ busy: false, status: "synced", needsReauth: false });
    } catch (e) {
      const needsReauth = e instanceof sync.ReauthRequiredError;
      set({
        busy: false,
        status: "offline",
        needsReauth,
        error: e instanceof Error ? e.message : "Sync failed.",
      });
    }
  },

  useThisAccountInstead: async () => {
    sync.abandonRememberedSheet();
    set({ previousSpreadsheetId: sync.getPreviousSpreadsheetId() });
    await get().connect();
  },

  startNewSheet: async () => {
    set({ busy: true, error: "", status: "syncing" });
    try {
      const id = await sync.createNewSheet();
      set({
        connected: true,
        spreadsheetId: id,
        previousSpreadsheetId: sync.getPreviousSpreadsheetId(),
        busy: false,
        needsReauth: false,
        status: "synced",
      });
    } catch (e) {
      set({
        busy: false,
        status: get().connected ? "synced" : "offline",
        error: e instanceof Error ? e.message : "Could not start a new sheet.",
      });
    }
  },

  tapToRetry: async () => {
    if (get().needsReauth) {
      set({ busy: true, error: "" });
      try {
        await sync.reauth();
        set({ busy: false, status: "synced", needsReauth: false });
      } catch (e) {
        set({
          busy: false,
          status: get().connected ? "synced" : "offline",
          error: e instanceof Error ? e.message : "Could not reconnect.",
        });
      }
    } else {
      await get().syncNow();
    }
    const err = get().error;
    if (err) useToast.getState().show({ message: err });
  },
}));

/**
 * Resume any push a prior session left pending instead of leaving it stuck
 * until the next unrelated edit happens to touch the same tab. Silent only —
 * a page load has no click behind it.
 *
 * MUST be called only after the Zustand stores have actually been hydrated
 * from IndexedDB (i.e. after bootstrap() resolves — see stores/bootstrap.ts's
 * call to this), never at this module's own top-level scope. This module is
 * imported (directly or transitively) by bootstrap.ts itself, so its
 * synchronous top-level code runs during initial script evaluation — well
 * before bootstrap()'s async IndexedDB reads even start. A push resumed that
 * early would read tabValues() off the stores' still-empty defaults and
 * clear+overwrite the real Sheet tab with nothing but a header row.
 */
export function resumePendingPush(): void {
  if (sync.isConnected() && sync.hasPendingPush()) {
    sync.attemptPush(
      (s) => useSync.setState({ status: s }),
      () => flagNeedsReauth(useSync.getState, useSync.setState)
    );
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    const st = useSync.getState();
    // false: the network reconnecting has nothing to do with a user click and
    // can fire while the tab isn't even focused — must never risk a popup.
    if (st.connected) void st.syncNow(false);
    else useSync.setState({ status: "synced", pending: 0 });
  });
  window.addEventListener("offline", () => useSync.setState({ status: "offline" }));

  // Proactively top up the Google token between edits instead of only ever
  // checking reactively at the exact moment a save needs one.
  const warmUp = () =>
    void sync.keepTokenWarm(
      useSync.getState().needsReauth,
      () => flagNeedsReauth(useSync.getState, useSync.setState)
    );
  warmUp();
  setInterval(warmUp, 5 * 60_000);
  // Browsers throttle timers in a backgrounded/hidden tab, so also check
  // immediately whenever the tab regains focus — catches up on whatever the
  // throttled interval missed the instant the tab is actually usable again.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") warmUp();
  });
}
