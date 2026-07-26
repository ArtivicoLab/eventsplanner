// Sync layer. Bridges the local IndexedDB stores and the user's Google
// Sheet. Single-user: we mirror each collection to its own tab. Reads pull
// the whole sheet; writes are local-first, then a debounced per-tab push
// (last-write-wins by the device that saved most recently — safe for one user).
//
// This mirrors TrackerA (Life Planner)'s sync engine, including every
// documented fix in its incident history (dirty-tab persistence across a
// reload, serialized push chain, push-before-pull on reconnect, no default on
// allowInteractive, per-tab write isolation, etc.) — ported at the fix, not
// the bug. See TrackerA's own CLAUDE.md for the full incident log if this
// file needs touching.

import * as db from "./db";
import {
  eventTaskToRow,
  eventToRow,
  expenseToRow,
  guestToRow,
  HEADERS,
  roomToRow,
  rowToEvent,
  rowToEventTask,
  rowToExpense,
  rowToGuest,
  rowToRoom,
  SPREADSHEET_TITLE,
  TAB,
} from "./schema";
import {
  batchGet,
  createSpreadsheet,
  ensureTabs,
  ReauthRequiredError,
  SheetNotFoundError,
  SheetPermissionDeniedError,
  writeTab,
} from "./google/sheets";
export { ReauthRequiredError, SheetPermissionDeniedError };
import { forgetToken, requestToken, tokenTimeLeftMs } from "./google/auth";
import { isValidAccessCode } from "./access";
import { isDemo } from "./demo";
import { useSettings } from "../stores/useSettings";
import { useEvents } from "../stores/useEvents";
import { useEventTasks } from "../stores/useEventTasks";
import { useExpenses } from "../stores/useExpenses";
import { useRooms } from "../stores/useRooms";
import { useGuests } from "../stores/useGuests";
import type { EventItem, EventTask, Expense, Guest, Room } from "./types";

const LS_ID = "ep.spreadsheetId";
// Separate from LS_ID on purpose: LS_ID is kept forever once a sheet exists,
// so a later connect() always relinks to the SAME sheet. This is an opt-OUT
// flag (absence = connected), not opt-in — an opt-in flag that's only ever
// set inside connect() would silently break syncing for anyone already
// connected before the flag existed.
const LS_DISCONNECTED = "ep.disconnected";
// Remembers whatever LS_ID was about to be abandoned (start-a-new-sheet,
// wrong-account recovery) so it's not just gone from the user's perspective —
// the sheet itself is never deleted, only unlinked.
const LS_PREVIOUS_ID = "ep.previousSpreadsheetId";

/** Accepts a raw spreadsheet id or a full Google Sheets URL and returns the id. */
export function extractSpreadsheetId(idOrUrl: string): string {
  const trimmed = idOrUrl.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

export function getSpreadsheetId(): string {
  return localStorage.getItem(LS_ID) ?? "";
}
export function isConnected(): boolean {
  return getSpreadsheetId().length > 0 && localStorage.getItem(LS_DISCONNECTED) !== "1";
}
function setSpreadsheetId(id: string) {
  localStorage.setItem(LS_ID, id);
  localStorage.removeItem(LS_DISCONNECTED);
}

const SYNC_TABS = [TAB.Events, TAB.EventTasks, TAB.Expenses, TAB.Rooms, TAB.Guests];

// Maps an IndexedDB collection to the single Sheet tab it lives in — lets a
// mutation push just its own tab instead of rewriting every tab on every edit.
export const COLLECTION_TAB: Record<db.Collection, string> = {
  events: TAB.Events,
  eventTasks: TAB.EventTasks,
  expenses: TAB.Expenses,
  rooms: TAB.Rooms,
  guests: TAB.Guests,
};

// Tabs pending a push, persisted to localStorage (not just kept in memory)
// because the debounced flush waits 2s after the last edit before actually
// pushing — a reload inside that window (a manual refresh, or the app's own
// service-worker auto-update reload) must not silently drop the fact that a
// tab still needs to reach the Sheet while the header shows a blind "Synced".
const LS_DIRTY_TABS = "ep.dirtyTabs";

function loadDirtyTabs(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DIRTY_TABS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    const valid: string[] = SYNC_TABS;
    return new Set(parsed.filter((t) => valid.includes(t)));
  } catch {
    return new Set();
  }
}

function persistDirtyTabs(): void {
  try {
    localStorage.setItem(LS_DIRTY_TABS, JSON.stringify([...dirtyTabs]));
  } catch {
    /* localStorage unavailable (private mode, quota) — in-memory Set still covers this page load */
  }
}

let dirtyTabs = loadDirtyTabs();
export function markDirty(tab?: string): void {
  if (tab) dirtyTabs.add(tab);
  else SYNC_TABS.forEach((t) => dirtyTabs.add(t)); // no tab given: fall back to a full push
  persistDirtyTabs();
}

/** Whether a prior session left work that never reached the Sheet — e.g. a
    reload landed inside the 2s debounce window before it could push. Used
    on boot to resume the flush instead of trusting a blind "Synced". */
export function hasPendingPush(): boolean {
  return dirtyTabs.size > 0;
}

// ---- push: build a full tab (header + current rows) ----
// Reads straight from IndexedDB (the shared, durable store), NOT from this
// tab/window's in-memory Zustand snapshot — two open tabs/windows on one
// device each hydrate their own in-memory store once at boot and never learn
// about a sibling's edits. Building a push from in-memory state means
// whichever tab pushes LAST silently clear+rewrites the whole Sheet tab from
// its own stale snapshot. IndexedDB is shared across every tab/window on the
// same origin, so reading fresh from it here means whichever tab happens to
// push always pushes the current union of everyone's committed writes.
async function tabValues(tab: string): Promise<string[][]> {
  const header = HEADERS[tab] ?? [];
  let rows: string[][] = [];
  switch (tab) {
    case TAB.Events: rows = (await db.all<EventItem>("events")).map(eventToRow); break;
    case TAB.EventTasks: rows = (await db.all<EventTask>("eventTasks")).map(eventTaskToRow); break;
    case TAB.Expenses: rows = (await db.all<Expense>("expenses")).map(expenseToRow); break;
    case TAB.Rooms: rows = (await db.all<Room>("rooms")).map(roomToRow); break;
    case TAB.Guests: rows = (await db.all<Guest>("guests")).map(guestToRow); break;
  }
  return [header, ...rows];
}

// In-memory only (never persisted, never survives a reload) — exists so any
// code path that temporarily swaps real stores for sample/demo data can stop
// a push from clobbering a real, connected Sheet with fake rows while that
// swap is active.
let syncSuspended = false;
export function suspendSync(): void {
  syncSuspended = true;
}
export function resumeSync(): void {
  syncSuspended = false;
}

// pushAll() and pushDirty() must never run concurrently with each other OR
// with themselves — two independent clear+write cycles against the same tab
// can resolve out of request order, so whichever finishes SECOND can
// silently overwrite a newer write with an older snapshot. A simple promise
// chain serializes every call through here, regardless of which function or
// how many callers.
let pushChain: Promise<void> = Promise.resolve();
function serialized(fn: () => Promise<void>): Promise<void> {
  const run = pushChain.catch(() => {}).then(fn);
  pushChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * `allowInteractive` has NO default on purpose — every caller must consciously
 * decide. pushAll() is reachable from the `online` browser event (network
 * reconnects), which has nothing to do with a user click and can fire while
 * the tab isn't even focused — defaulting this to "allowed" is exactly how a
 * Google popup can appear while the window isn't in use. Pass `true` only
 * from a genuine, current click handler (Connect, Sync now); `false` from
 * anything automatic.
 */
export function pushAll(allowInteractive: boolean): Promise<void> {
  return serialized(() => pushAllInner(allowInteractive));
}

async function pushAllInner(allowInteractive: boolean): Promise<void> {
  if (isDemo() || syncSuspended) return;
  const id = getSpreadsheetId();
  if (!id) return;
  await ensureTabs(id, SYNC_TABS, allowInteractive);
  await writeAllTabs(id, SYNC_TABS, allowInteractive);
}

/**
 * Push only the tabs a mutation actually touched (see markDirty). A tab is
 * only cleared from the dirty set once it's actually written, so a rate-
 * limited/failed push retries it next time.
 */
export function pushDirty(): Promise<void> {
  return serialized(pushDirtyInner);
}

async function pushDirtyInner(): Promise<void> {
  if (isDemo() || syncSuspended) return;
  const id = getSpreadsheetId();
  if (!id) return;
  const tabs = [...dirtyTabs];
  if (tabs.length === 0) return;
  await ensureTabs(id, tabs, false);
  await writeAllTabs(id, tabs, false);
}

/**
 * Shared write loop for pushAll/pushDirty. One tab's write failing doesn't
 * abort the rest of the batch — each tab is isolated in its own try/catch,
 * so a single broken tab can't starve every other pending edit behind it. A
 * ReauthRequiredError is the one exception: the same token backs every call
 * in this loop, so if the FIRST one is dead they all will be identically —
 * bail immediately so the caller's reauth handling fires right away.
 */
async function writeAllTabs(id: string, tabs: string[], allowInteractive: boolean): Promise<void> {
  let firstError: unknown;
  for (const tab of tabs) {
    try {
      await writeTab(id, tab, await tabValues(tab), allowInteractive);
      dirtyTabs.delete(tab);
      persistDirtyTabs();
    } catch (err) {
      if (err instanceof ReauthRequiredError) throw err;
      firstError = firstError ?? err;
    }
  }
  if (firstError) throw firstError;
}

// Checks proactively, between edits, so a needed reconnect surfaces calmly
// on the sync pill BEFORE it's blocking anything, not the moment a save needs
// a token.
const TOKEN_REFRESH_MARGIN_MS = 10 * 60_000; // top up once under 10 min of life left
export async function keepTokenWarm(
  alreadyNeedsReauth: boolean,
  onReauthRequired: () => void
): Promise<void> {
  if (isDemo() || !isConnected() || !navigator.onLine) return;
  // Already known broken and waiting on the user to click "tap to reconnect"
  // — retrying the same silent request every 5 minutes just re-confirms the
  // same failure with nothing new to learn from it.
  if (alreadyNeedsReauth) return;
  if (tokenTimeLeftMs() > TOKEN_REFRESH_MARGIN_MS) return; // still plenty of runway
  try {
    await requestToken(false); // silent only — never pop a window from a timer
  } catch {
    onReauthRequired();
  }
}

// ---- pull: replace local data from the sheet ----
function parseRows<T>(rows: string[][], fromRow: (r: string[]) => T): T[] {
  return rows
    .slice(1) // rows[0] is the app-written header
    .filter((r) => (r[0] ?? "").trim().length > 0)
    .map(fromRow);
}

export async function pull(allowInteractive: boolean): Promise<void> {
  const id = getSpreadsheetId();
  if (!id) return;
  const data = await batchGet(id, SYNC_TABS, allowInteractive);

  const events = parseRows<EventItem>(data[TAB.Events] ?? [], rowToEvent);
  const eventTasks = parseRows<EventTask>(data[TAB.EventTasks] ?? [], rowToEventTask);
  const expenses = parseRows<Expense>(data[TAB.Expenses] ?? [], rowToExpense);
  const rooms = parseRows<Room>(data[TAB.Rooms] ?? [], rowToRoom);
  const guests = parseRows<Guest>(data[TAB.Guests] ?? [], rowToGuest);

  await Promise.all([
    replaceStore("events", events),
    replaceStore("eventTasks", eventTasks),
    replaceStore("expenses", expenses),
    replaceStore("rooms", rooms),
    replaceStore("guests", guests),
  ]);

  useEvents.getState().setAll(events);
  useEventTasks.getState().setAll(eventTasks);
  useExpenses.getState().setAll(expenses);
  useRooms.getState().setAll(rooms);
  useGuests.getState().setAll(guests);
}

async function replaceStore<T extends { id: string }>(store: db.Collection, values: T[]) {
  await db.clearStore(store);
  if (values.length) await db.putMany(store, values);
}

// ---- Meta tab: a tiny key/value store carried inside the user's own Sheet ----
async function readMetaTab(id: string, allowInteractive: boolean): Promise<Map<string, string>> {
  const data = await batchGet(id, [TAB.Meta], allowInteractive).catch(() => ({}) as Record<string, string[][]>);
  const rows = (data[TAB.Meta] ?? []).slice(1); // skip header
  return new Map(rows.filter((r) => (r[0] ?? "").trim()).map((r) => [r[0], r[1] ?? ""]));
}

async function writeMetaKey(id: string, key: string, value: string, allowInteractive: boolean): Promise<void> {
  const map = await readMetaTab(id, allowInteractive);
  map.set(key, value);
  await writeTab(id, TAB.Meta, [["key", "value"], ...map.entries()], allowInteractive);
}

const ACCESS_CODE_META_KEY = "accessCode";

/**
 * Keep the buyer's Etsy access code and the Sheet in sync, both directions:
 * already activated locally -> push it up (so a second device that later
 * connects to this same Sheet inherits it); not yet activated but the Sheet
 * already carries a code from a previous device -> adopt it locally.
 */
async function syncAccessCode(id: string, allowInteractive: boolean): Promise<void> {
  const settings = useSettings.getState();
  if (settings.activated && settings.accessCode) {
    await writeMetaKey(id, ACCESS_CODE_META_KEY, settings.accessCode, allowInteractive).catch(() => {});
    return;
  }
  const map = await readMetaTab(id, allowInteractive).catch(() => new Map<string, string>());
  const remoteCode = map.get(ACCESS_CODE_META_KEY) ?? "";
  if (remoteCode && isValidAccessCode(remoteCode)) {
    settings.update({ activated: true, accessCode: remoteCode });
  }
}

/**
 * Lightweight reconnect for the common "token just expired, tab sat open a
 * while" case — tapToRetry()'s needsReauth branch. Deliberately narrower
 * than connect(): a fresh token then one pushDirty, nothing else. Requests
 * the token FIRST, synchronously off the click, before any silent attempt —
 * trying silent first risks the eventual interactive fallback landing
 * outside the browser's user-gesture window.
 */
export async function reauth(): Promise<void> {
  await requestToken(true);
  await pushAll(true);
}

/**
 * Connect a Google account. If a sheet id is remembered we relink + pull;
 * otherwise we create a fresh app-managed spreadsheet and push local data up.
 * Returns the spreadsheet id.
 */
export async function connect(): Promise<string> {
  // Ask for an interactive token FIRST, straight off the click — every other
  // Sheets call below tries a silent refresh before falling back to a popup,
  // which would delay the very first popup here past the click's window for
  // the browser to treat it as user-initiated.
  await requestToken(true);

  // Leaving demo BEFORE any push/pull: setDemoMode reloads the stores from
  // the user's real (blank for a new buyer) IndexedDB, so pushAll below
  // seeds the new sheet with THAT — never the in-memory sample. Dynamic
  // import avoids the sync <-> bootstrap <-> useSync require cycle.
  if (isDemo()) {
    const { setDemoMode } = await import("../stores/bootstrap");
    await setDemoMode(false);
  }

  const existing = getSpreadsheetId();
  if (existing) {
    try {
      await ensureTabs(existing, SYNC_TABS, true);
      localStorage.removeItem(LS_DISCONNECTED);
      // Push local changes UP before pulling the sheet down. This device may
      // have kept working (safely, in IndexedDB) through a stretch where the
      // connection was stuck needing reauth — background pushes were failing
      // that whole time, so the SHEET is the stale side here, not the
      // device. A pull()-only reconnect would blindly overwrite local data
      // with that stale sheet content. We just got a fresh interactive token
      // above, so this push is reliable; pull() afterward then just reads
      // back a sheet that already reflects this device's latest state.
      await pushAll(true);
      await pull(true);
      await syncAccessCode(existing, true);
      return existing;
    } catch (err) {
      if (err instanceof SheetNotFoundError) {
        localStorage.removeItem(LS_ID);
        // fall through to create a new one
      } else {
        // A SheetPermissionDeniedError lands here too — the signed-in account
        // isn't the one that owns the remembered sheet. Deliberately NOT
        // auto-abandoning the old link or auto-creating a new sheet here:
        // that could silently hide a simple "picked the wrong account"
        // mistake behind what looks like a fresh, empty planner. Propagate
        // the typed error so the UI can offer an explicit choice instead.
        throw err;
      }
    }
  }
  const id = await createSpreadsheet(SPREADSHEET_TITLE, SYNC_TABS, true);
  setSpreadsheetId(id);
  await pushAll(true); // seed the new sheet with whatever is on-device now
  await syncAccessCode(id, true);
  return id;
}

/**
 * Create and link a brand new, empty spreadsheet for an ALREADY-connected
 * user who wants to abandon their current one and start fresh (Settings'
 * "Start a new sheet"). The old sheet must NOT be abandoned until the new
 * one is confirmed reachable — getting the token first means a failure here
 * throws before anything about the old sheet has changed at all.
 */
export async function createNewSheet(): Promise<string> {
  await requestToken(true);
  const id = await createSpreadsheet(SPREADSHEET_TITLE, SYNC_TABS, true);
  abandonRememberedSheet();
  setSpreadsheetId(id);
  await pushAll(true);
  await syncAccessCode(id, true);
  return id;
}

/**
 * Relink to a spreadsheet id (or full Sheets URL) the user pasted in — the
 * genuine cross-device path: a brand-new browser has no remembered id and no
 * local access code, so this is how it recovers both the real data AND the
 * activation state from an already-connected device's Sheet, with no re-typed
 * code and no wipe.
 */
export async function relink(idOrUrl: string): Promise<void> {
  const id = extractSpreadsheetId(idOrUrl);
  if (!id) throw new Error("That doesn't look like a Google Sheet link or ID.");
  await requestToken(true);
  // Leaving demo BEFORE pull(): pull()'s writes to IndexedDB are gated off
  // while demo mode is on, so without this the real Sheet data pulled below
  // would show in the stores for this session only, never actually persist
  // locally, and get silently wiped back to the in-memory sample on the very
  // next reload. A brand-new browser/device defaults to demo mode ON, which
  // is exactly relink()'s own target scenario.
  if (isDemo()) {
    const { setDemoMode } = await import("../stores/bootstrap");
    await setDemoMode(false);
  }
  await ensureTabs(id, SYNC_TABS, true);
  setSpreadsheetId(id);
  await pull(true);
  await syncAccessCode(id, true);
}

/**
 * The durable, synchronous half of disconnecting: mark this device as
 * disconnected and stop the background sync loop. Deliberately kept separate
 * from forgetting the token so a caller can call this FIRST, before any
 * slower async step like a final best-effort push — a page refresh at any
 * point after this line still leaves the app correctly "disconnected".
 */
export function markDisconnected(): void {
  // Deliberately keep LS_ID — see its declaration's comment. Only mark
  // "disconnected" so the next Connect click relinks to this same sheet
  // instead of minting a new one.
  localStorage.setItem(LS_DISCONNECTED, "1");
  if (timer) clearTimeout(timer);
  clearRetry(); // no point quietly retrying a push once the user has disconnected
}

export function disconnect() {
  markDisconnected();
  forgetToken();
}

/**
 * The explicit "yes, really use a different Google account" recovery step for
 * a SheetPermissionDeniedError, and also what createNewSheet() calls: forgets
 * the remembered sheet id so the next connect() call creates a brand-new
 * spreadsheet, instead of retrying against the one it has no access to.
 * Stashes the outgoing id as "previous" first so the app can still point
 * back to it — the sheet itself is never deleted here, only unlinked.
 */
export function abandonRememberedSheet(): void {
  const outgoing = getSpreadsheetId();
  if (outgoing) localStorage.setItem(LS_PREVIOUS_ID, outgoing);
  localStorage.removeItem(LS_ID);
}

/** The id of whatever sheet was most recently abandoned via
    abandonRememberedSheet(), if any — for a "your previous sheet is still
    here, open it" link, not for reconnecting automatically. */
export function getPreviousSpreadsheetId(): string {
  return localStorage.getItem(LS_PREVIOUS_ID) ?? "";
}

// ---- debounced flush on every mutation, with background retry on failure ----
let timer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 120_000;
let retryDelay = RETRY_BASE_MS;
let pushInFlight = false;

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryDelay = RETRY_BASE_MS;
}

export function attemptPush(
  onState: (s: "syncing" | "synced" | "offline") => void,
  onReauthRequired: () => void
) {
  if (pushInFlight) {
    retryTimer = setTimeout(() => attemptPush(onState, onReauthRequired), 3000);
    return;
  }
  if (!navigator.onLine) {
    onState("offline");
    retryTimer = setTimeout(() => attemptPush(onState, onReauthRequired), retryDelay);
    return;
  }
  onState("syncing");
  pushInFlight = true;
  pushDirty()
    .then(() => {
      clearRetry();
      onState("synced");
    })
    .catch((err) => {
      onState("offline");
      if (err instanceof ReauthRequiredError) {
        // Deliberately NOT rescheduling a retry here — a silent refresh that
        // just failed will keep failing identically every time until the
        // user actually does something.
        onReauthRequired();
        return;
      }
      retryTimer = setTimeout(() => attemptPush(onState, onReauthRequired), retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    })
    .finally(() => {
      pushInFlight = false;
    });
}

export function scheduleFlush(
  onState: (s: "syncing" | "synced" | "offline") => void,
  onReauthRequired: () => void
) {
  if (!isConnected()) return;
  if (!navigator.onLine) {
    onState("offline");
    return;
  }
  if (timer) clearTimeout(timer);
  clearRetry(); // a fresh edit supersedes any pending backoff retry
  onState("syncing");
  timer = setTimeout(() => attemptPush(onState, onReauthRequired), 2000);
}
