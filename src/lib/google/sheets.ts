// Typed Google Sheets REST wrapper. Raw fetch + bearer token, with a single
// transparent retry on 401 (token expiry).

import { invalidateToken, requestToken } from "./auth";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// Thrown instead of opening an interactive Google popup when the caller has
// no real user click behind it (see allowInteractive below). Falling back to
// an interactive requestAccessToken() from a background timer is genuinely
// dangerous: browsers block popups that aren't a direct result of a user
// gesture, and GIS's callback then simply never fires — the Promise hangs
// forever with no error. Background code must catch this and prompt the
// user to tap something themselves; only that click is allowed to open a
// popup.
export class ReauthRequiredError extends Error {}

// Plain fetch() has NO built-in timeout — a dropped connection or an
// unresponsive server can hang forever with no error. Every request through
// authedFetch is hard-bounded so a hang always surfaces as a real, catchable
// error within FETCH_TIMEOUT_MS.
const FETCH_TIMEOUT_MS = 20_000;

async function authedFetch(
  url: string,
  init: RequestInit = {},
  allowInteractive: boolean,
  retry = true
): Promise<Response> {
  let token: string;
  try {
    token = await requestToken(false); // always try silent first
  } catch {
    if (!allowInteractive) {
      throw new ReauthRequiredError("Your Google connection needs a quick refresh. Tap to reconnect.");
    }
    token = await requestToken(true); // popup — only ever reached from a real click
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Google Sheets took too long to respond. Try again in a moment.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 401 && retry) {
    // The cached token looked time-valid but the server just rejected it —
    // drop it so the retry actually fetches a fresh one.
    invalidateToken();
    if (!allowInteractive) {
      throw new ReauthRequiredError("Your Google connection needs a quick refresh. Tap to reconnect.");
    }
    await requestToken(true);
    return authedFetch(url, init, allowInteractive, false);
  }
  return res;
}

export class SheetNotFoundError extends Error {}
// The signed-in Google account has no access to the remembered spreadsheet —
// almost always means someone connected with a DIFFERENT Google account than
// the one that originally made their sheet (a real, expected case, not a bug).
export class SheetPermissionDeniedError extends Error {}

async function ok(res: Response): Promise<unknown> {
  if (res.status === 404) throw new SheetNotFoundError("Spreadsheet not found");
  if (res.status === 403) throw new SheetPermissionDeniedError("No access to this spreadsheet with the signed-in Google account");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Create a spreadsheet with the given tab titles. Returns its id. */
export async function createSpreadsheet(
  title: string,
  tabTitles: string[],
  allowInteractive: boolean
): Promise<string> {
  const body = {
    properties: { title },
    sheets: tabTitles.map((t) => ({ properties: { title: t } })),
  };
  const res = await authedFetch(BASE, { method: "POST", body: JSON.stringify(body) }, allowInteractive);
  const json = (await ok(res)) as { spreadsheetId: string };
  return json.spreadsheetId;
}

export interface SpreadsheetMeta {
  title: string;
  tabTitles: string[];
  tabIds: Record<string, number>;
}

export async function getMeta(spreadsheetId: string, allowInteractive: boolean): Promise<SpreadsheetMeta> {
  const res = await authedFetch(
    `${BASE}/${spreadsheetId}?fields=properties.title,sheets.properties.title,sheets.properties.sheetId`,
    {},
    allowInteractive
  );
  const json = (await ok(res)) as {
    properties: { title: string };
    sheets: { properties: { title: string; sheetId: number } }[];
  };
  return {
    title: json.properties.title,
    tabTitles: json.sheets.map((s) => s.properties.title),
    tabIds: Object.fromEntries(json.sheets.map((s) => [s.properties.title, s.properties.sheetId])),
  };
}

/**
 * Add any missing tabs (used to migrate an older sheet forward). `renames`
 * (old title -> new title) is checked FIRST: an existing tab whose title
 * matches an old name is renamed IN PLACE (its data untouched) rather than
 * left alone while a brand-new, empty tab gets created under the new name.
 */
export async function ensureTabs(
  spreadsheetId: string,
  wantTabs: string[],
  allowInteractive: boolean,
  renames: Record<string, string> = {}
): Promise<void> {
  const meta = await getMeta(spreadsheetId, allowInteractive);
  const titles = new Set(meta.tabTitles);
  const requests: unknown[] = [];

  for (const [oldTitle, newTitle] of Object.entries(renames)) {
    if (!titles.has(oldTitle) || titles.has(newTitle)) continue;
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: meta.tabIds[oldTitle], title: newTitle },
        fields: "title",
      },
    });
    titles.delete(oldTitle);
    titles.add(newTitle);
  }

  const missing = wantTabs.filter((t) => !titles.has(t));
  for (const title of missing) requests.push({ addSheet: { properties: { title } } });

  if (requests.length === 0) return;
  const res = await authedFetch(`${BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  }, allowInteractive);
  await ok(res);
}

/** Read several tab ranges in one call. Returns tab -> 2D string values. */
export async function batchGet(
  spreadsheetId: string,
  tabs: string[],
  allowInteractive: boolean
): Promise<Record<string, string[][]>> {
  const params = tabs.map((t) => `ranges=${encodeURIComponent(t)}`).join("&");
  const res = await authedFetch(`${BASE}/${spreadsheetId}/values:batchGet?${params}`, {}, allowInteractive);
  const json = (await ok(res)) as {
    valueRanges: { range: string; values?: string[][] }[];
  };
  const out: Record<string, string[][]> = {};
  json.valueRanges.forEach((vr, i) => {
    out[tabs[i]] = vr.values ?? [];
  });
  return out;
}

/**
 * Overwrite a whole tab with `values` (header row + data). Clears stale rows
 * first. `allowInteractive` must be false for background/unattended callers
 * (the debounced auto-sync) — see ReauthRequiredError above.
 */
export async function writeTab(
  spreadsheetId: string,
  tab: string,
  values: string[][],
  allowInteractive: boolean
): Promise<void> {
  const clearRes = await authedFetch(
    `${BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}:clear`,
    { method: "POST", body: "{}" },
    allowInteractive
  );
  await ok(clearRes);
  const res = await authedFetch(
    `${BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}!A1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values }) },
    allowInteractive
  );
  await ok(res);
}

export function spreadsheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

/**
 * Email address of the signed-in Google account, via Drive's about.get —
 * which the app's existing drive.file scope already permits, so this adds
 * NO new OAuth scope and needs no consent-screen change (see TrackerA's
 * CLAUDE.md for why touching the scope list is a real gotcha). Used to
 * remember WHICH account the user's sheet lives in, so someone with several
 * Google accounts isn't left guessing at the account picker.
 */
export async function fetchAccountEmail(allowInteractive: boolean): Promise<string> {
  const res = await authedFetch(
    "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)",
    {},
    allowInteractive
  );
  const json = (await ok(res)) as { user?: { emailAddress?: string } };
  return json.user?.emailAddress ?? "";
}
