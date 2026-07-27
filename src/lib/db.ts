// IndexedDB persistence. One object store per collection, each keyed by
// `id`. `kv` store holds settings + pointers.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION } from "./config";
import type { EventItem, EventTask, Expense, Guest, Room } from "./types";

export type Collection = "events" | "eventTasks" | "expenses" | "rooms" | "guests";

export const ALL_COLLECTIONS: Collection[] = ["events", "eventTasks", "expenses", "rooms", "guests"];

interface EP extends DBSchema {
  events: { key: string; value: EventItem };
  eventTasks: { key: string; value: EventTask };
  expenses: { key: string; value: Expense };
  rooms: { key: string; value: Room };
  guests: { key: string; value: Guest };
  kv: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<EP>> | null = null;

function db(): Promise<IDBPDatabase<EP>> {
  if (!dbp) {
    dbp = openDB<EP>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        for (const name of ["events", "eventTasks", "expenses", "rooms", "guests"] as const) {
          if (!d.objectStoreNames.contains(name)) {
            d.createObjectStore(name, { keyPath: "id" });
          }
        }
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      },
    });
  }
  return dbp;
}

// Demo mode: while on, collection writes are no-ops so the sample data (and
// any poking a logged-out visitor does to it) is memory-only — it never
// lands in IndexedDB and so can never be pushed to a user's Google Sheet or
// masquerade as real data later. Only per-record mutations are gated;
// clearStore/setKV/wipeAll stay live so migration, settings, and resets
// still work.
let demoMode = false;
export function setDbDemoMode(on: boolean): void {
  demoMode = on;
}

export async function all<T>(store: Collection): Promise<T[]> {
  return (await db()).getAll(store) as Promise<T[]>;
}

export async function put<T extends { id: string }>(store: Collection, value: T): Promise<void> {
  if (demoMode) return;
  await (await db()).put(store, value as never);
}

export async function putMany<T extends { id: string }>(store: Collection, values: T[]): Promise<void> {
  if (demoMode) return;
  const d = await db();
  const tx = d.transaction(store, "readwrite");
  await Promise.all([...values.map((v) => tx.store.put(v as never)), tx.done]);
}

export async function remove(store: Collection, id: string): Promise<void> {
  if (demoMode) return;
  await (await db()).delete(store, id);
}

export async function clearStore(store: Collection): Promise<void> {
  await (await db()).clear(store);
}

// ---- key/value (settings, pointers, flags) ----
export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db()).get("kv", key) as Promise<T | undefined>;
}
export async function setKV(key: string, value: unknown): Promise<void> {
  await (await db()).put("kv", value, key);
}

export async function wipeAll(): Promise<void> {
  const d = await db();
  await Promise.all([...ALL_COLLECTIONS, "kv"].map((s) => d.clear(s as never)));
}

// "Start over" only promises to erase planner content (events/tasks/expenses/
// rooms/guests) — unlike wipeAll(), this leaves the `kv` store (Settings:
// categories, owners, currency, activation/access code) untouched, so a
// buyer's device-level setup and purchased status survive a reset.
export async function wipeCollections(): Promise<void> {
  const d = await db();
  await Promise.all(ALL_COLLECTIONS.map((s) => d.clear(s as never)));
}
