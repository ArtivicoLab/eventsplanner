// Google Identity Services (GIS) token client. No gapi — we load the tiny
// GIS script and call REST endpoints with fetch ourselves.
//
// Only one scope is ever requested (drive.file — non-sensitive, no Google
// verification review needed). There is no Calendar integration in this app
// at all (unlike sibling planner apps that flirt with calendar.events) — an
// event scheduler's actual database is the Sheet, and keeping to a single
// non-sensitive scope means every sign-in stays on Google's fast, unverified-
// app-safe consent path.

const GIS_SRC = "https://accounts.google.com/gsi/client";
export const SCOPE_SHEETS = "https://www.googleapis.com/auth/drive.file";

export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
export const hasClientId = CLIENT_ID.length > 0;

interface TokenState {
  token: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenState | undefined;

// An in-memory-only cache gets silently wiped by any reload (a new deploy's
// auto-update reload, a manual refresh, a backgrounded tab getting reclaimed)
// even though the real Google token might still have 40+ minutes of genuine
// validity left — mirrored into sessionStorage (survives a reload, scoped to
// this tab/session, gone when the tab closes) so a reload revives a still-
// valid token instead of forcing a fresh sign-in from zero every time.
const SESSION_KEY = "ep.token";

function persistToken(entry: TokenState) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry));
  } catch {
    /* sessionStorage unavailable (private mode, quota) — in-memory cache still covers this page load */
  }
}

function forgetPersistedToken() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** In-memory cache miss doesn't necessarily mean "no valid token" — check
    sessionStorage before concluding a fresh sign-in is needed. */
function getCached(): TokenState | undefined {
  if (tokenCache) return tokenCache;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as TokenState;
    if (parsed.expiresAt - Date.now() <= 60_000) {
      forgetPersistedToken(); // expired (or near enough) — don't keep reviving a dead token
      return undefined;
    }
    tokenCache = parsed;
    return parsed;
  } catch {
    return undefined;
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (resp: {
              access_token?: string;
              expires_in?: number;
              scope?: string;
              error?: string;
            }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gisReady: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google sign-in. Check your connection."));
    document.head.appendChild(s);
  });
  return gisReady;
}

/**
 * Fetch the Google sign-in script ahead of time (fire-and-forget), so it's
 * already loaded by the time the user clicks Connect. Without this, the first
 * click has to wait on a real network round-trip before it can call
 * requestAccessToken() — which happens outside the click's synchronous call
 * stack and can make browsers treat the resulting popup as not user-initiated
 * (opens, then gets closed immediately).
 */
export function preloadGis(): void {
  if (hasClientId) void loadGis();
}

function tokenValid(): boolean {
  const entry = getCached();
  return !!entry && entry.expiresAt - Date.now() > 60_000;
}

/** Milliseconds left before the cached token expires (0 if there is none
    cached at all). Lets background code decide "is this worth quietly
    refreshing now" without forcing a request. */
export function tokenTimeLeftMs(): number {
  const entry = getCached();
  return entry ? Math.max(0, entry.expiresAt - Date.now()) : 0;
}

const SILENT_TOKEN_TIMEOUT_MS = 10_000;
// While this app is unverified with Google, every interactive sign-in adds
// several extra required screens ("this app hasn't been verified" ->
// Advanced -> "Go to [app] (unsafe)" -> scope list -> consent). Bounded well
// under two minutes so a genuinely stuck/blocked popup surfaces an error
// instead of hanging silently forever, but generous enough for a real person
// to read every screen once.
const INTERACTIVE_TOKEN_TIMEOUT_MS = 100_000;

/**
 * Request (or silently refresh) an access token.
 * @param interactive false = try silent (prompt: ''); true = allow the popup.
 *   No default — every caller up the chain (authedFetch, pushAll, connect,
 *   etc.) is required to pass this explicitly. Background/unattended code
 *   must NEVER be allowed to fall back to an interactive popup: browsers
 *   block popups with no user gesture behind them, GIS's callback then never
 *   fires, and an un-bounded caller would hang forever with no error.
 */
export function requestToken(interactive: boolean): Promise<string> {
  if (!hasClientId) {
    return Promise.reject(
      new Error("No Google client ID configured. Add VITE_GOOGLE_CLIENT_ID to your .env.")
    );
  }
  if (tokenValid()) return Promise.resolve(getCached()!.token);

  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        let settled = false;
        const timeoutMs = interactive ? INTERACTIVE_TOKEN_TIMEOUT_MS : SILENT_TOKEN_TIMEOUT_MS;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error(interactive
            ? "Google sign-in didn't complete. If a popup was blocked, look for a blocked-popup icon in your address bar and allow it for this site. If the popup opened but showed a Google error page, that's a temporary issue on Google's end — just try again."
            : "Could not silently refresh your Google connection."));
        }, timeoutMs);

        const client = window.google!.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE_SHEETS,
          callback: (resp) => {
            if (settled) return; // already timed out — ignore a very late callback
            settled = true;
            clearTimeout(timeout);
            if (resp.error || !resp.access_token) {
              reject(new Error(resp.error || "Authorization was cancelled."));
              return;
            }
            const entry: TokenState = {
              token: resp.access_token,
              expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
            };
            tokenCache = entry;
            persistToken(entry);
            resolve(resp.access_token);
          },
        });
        // '' attempts silent; 'consent'-equivalent handled by GIS via prompt "" vs "none".
        client.requestAccessToken({ prompt: interactive ? "" : "none" });
      })
  );
}

/** Drop the cached token — e.g. after a 401 shows it's actually bad
    server-side even though it still looked time-valid locally. The NEXT
    requestToken() will fetch a genuinely fresh one. */
export function invalidateToken(): void {
  tokenCache = undefined;
  forgetPersistedToken();
}

export function forgetToken() {
  if (tokenCache) {
    try {
      window.google?.accounts.oauth2.revoke(tokenCache.token);
    } catch {
      /* ignore */
    }
  }
  tokenCache = undefined;
  forgetPersistedToken();
}
