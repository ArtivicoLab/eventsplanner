// Hydrate every store from IndexedDB on boot; seed sample data on first run.

import * as db from "../lib/db";
import { buildSample, type Seed } from "../lib/sample";
import { tryUnlock, type UnlockResult } from "../lib/access";
import { isDemo, setDemoFlag } from "../lib/demo";
import { useEvents } from "./useEvents";
import { useEventTasks } from "./useEventTasks";
import { useExpenses } from "./useExpenses";
import { useRooms } from "./useRooms";
import { useGuests } from "./useGuests";
import { useSettings } from "./useSettings";
import { resumePendingPush } from "./useSync";
import type { EventItem, EventTask, Expense, Guest, Room } from "../lib/types";

async function loadStores() {
  const [events, eventTasks, expenses, rooms, guests] = await Promise.all([
    db.all<EventItem>("events"),
    db.all<EventTask>("eventTasks"),
    db.all<Expense>("expenses"),
    db.all<Room>("rooms"),
    db.all<Guest>("guests"),
  ]);
  useEvents.getState().setAll(events);
  useEventTasks.getState().setAll(eventTasks);
  useExpenses.getState().setAll(expenses);
  useRooms.getState().setAll(rooms);
  useGuests.getState().setAll(guests);
}

// Load the sample straight into the in-memory stores. Nothing is written to
// IndexedDB (db writes are gated off while demo mode is on), so the dummy
// data is purely a display layer — it can never be pushed to a Sheet or
// mistaken for real data. Every reload rebuilds a fresh, complete demo.
export function loadSampleIntoStores(s: Seed = buildSample()) {
  useEvents.getState().setAll(s.events);
  useEventTasks.getState().setAll(s.eventTasks);
  useExpenses.getState().setAll(s.expenses);
  useRooms.getState().setAll(s.rooms);
  useGuests.getState().setAll(s.guests);
}

// Memoize so React StrictMode's double-invoked effect (or any repeat call)
// shares ONE run.
let bootPromise: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
  if (!bootPromise) bootPromise = runBootstrap();
  return bootPromise;
}

async function runBootstrap() {
  await useSettings.getState().load();
  const demo = isDemo();
  db.setDbDemoMode(demo);
  if (demo) {
    loadSampleIntoStores();
  } else {
    await loadStores();
  }
  // Only safe to resume a pending Sheets push now that every store above is
  // actually hydrated — see resumePendingPush()'s own doc comment for why
  // this can't run any earlier.
  resumePendingPush();
}

/**
 * Flip demo mode on/off at runtime (the Settings toggle). Turning it ON shows
 * the sample without touching the user's stored data; turning it OFF reloads
 * their real (possibly empty) data from IndexedDB.
 */
export async function setDemoMode(on: boolean): Promise<void> {
  setDemoFlag(on);
  db.setDbDemoMode(on);
  if (on) {
    loadSampleIntoStores();
  } else {
    await loadStores();
  }
}

/**
 * Unlock the real (Google Sheets-connectable) app with an Etsy purchase code.
 * Soft client-side check only (see lib/access.ts) — ALWAYS goes through
 * tryUnlock(), never isValidAccessCode() directly, so a wrong guess counts
 * against the escalating brute-force lockout no matter which screen calls
 * this. Under the memory-only demo model there's nothing to wipe — the
 * sample was never written to IndexedDB — so a successful unlock just leaves
 * demo mode and shows the user's own (blank for a new buyer) data.
 */
export async function activate(code: string): Promise<UnlockResult> {
  const result = await tryUnlock(code);
  if (!result.ok) return result;
  setDemoFlag(false);
  db.setDbDemoMode(false);
  if (!useSettings.getState().activated) {
    await loadStores();
    useSettings.getState().update({ activated: true, accessCode: code.trim().toUpperCase() });
  }
  return result;
}

export async function resetEverything() {
  setDemoFlag(false);
  db.setDbDemoMode(false);
  await db.wipeAll();
  useEvents.getState().setAll([]);
  useEventTasks.getState().setAll([]);
  useExpenses.getState().setAll([]);
  useRooms.getState().setAll([]);
  useGuests.getState().setAll([]);
}

/**
 * Disconnect Google Sheets AND remove this device's local copy — for someone
 * handing off or walking away from a shared/borrowed device who doesn't want
 * their planner visible to whoever picks it up next. A plain "Disconnect"
 * only stops syncing (see sync.ts); this also wipes IndexedDB.
 *
 * Marks the device disconnected FIRST, synchronously, before the slower
 * final-push/wipe steps below — a page refresh at any point during this
 * function still leaves the app correctly disconnected.
 */
export async function disconnectAndClearDevice(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const sync = await import("../lib/sync");
  const { useSync } = await import("./useSync");
  sync.markDisconnected();
  useSync.setState({ connected: false, wrongAccount: false, error: "" });

  try {
    // false: this is a trailing best-effort backup after the user already
    // confirmed "disconnect" — it must never surprise them with a popup.
    await sync.pushAll(false);
  } catch (e) {
    sync.disconnect(); // now safe to drop the token too; the device is disconnected either way
    return {
      ok: false,
      reason:
        e instanceof Error
          ? e.message
          : "Disconnected, but couldn't confirm your last changes reached Google Sheets — nothing on this device was cleared.",
    };
  }
  sync.disconnect();
  await db.wipeAll();
  useEvents.getState().setAll([]);
  useEventTasks.getState().setAll([]);
  useExpenses.getState().setAll([]);
  useRooms.getState().setAll([]);
  useGuests.getState().setAll([]);
  return { ok: true };
}

export { loadStores };
