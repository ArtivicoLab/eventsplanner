// Global build flags.
// LOCAL_MODE = true → the whole app runs on-device (IndexedDB) with no Google.
// Flip to false once the Sheets sync layer (lib/google/*) is wired in with a
// real OAuth client id (see .env.example).
export const LOCAL_MODE = false;

export const DB_NAME = "eventplanner";
// v2: added the "rooms" and "guests" object stores (Seating Chart).
export const DB_VERSION = 2;

// Copyright holder shown in Privacy / footers.
export const COPYRIGHT_HOLDER = "Event Planner";

// Version stamp shown in page footers — package.json version plus the short
// commit SHA, so a live site's (or local dev server's) freshness can be
// checked at a glance instead of guessing whether a deploy/rebuild actually
// landed. CI's VITE_COMMIT_SHA takes precedence when set (real deploys);
// __LOCAL_COMMIT_SHA__ (git HEAD at build time) covers local dev, where
// VITE_COMMIT_SHA is never set and APP_VERSION alone never changes.
export const APP_VERSION = __APP_VERSION__;
export const BUILD_SHA = (import.meta.env.VITE_COMMIT_SHA || __LOCAL_COMMIT_SHA__ || "").slice(0, 7);
