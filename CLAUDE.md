# CLAUDE.md — Event Planner

Guidance for any AI agent (or human) working in this repo. Read this first.

## Origin — forked/ported from TrackerA (Life Planner), 2026-07-23
Event Planner is one of several sibling PWAs cloning individual Etsy spreadsheet
products out of a shared architecture (TrackerA = Life Planner, the original/
reference build; TrackerB = Ultimate Budget; TrackerC = Social Planner; TrackerD =
Habit Tracker; TrackerE = Task Center; this one clones an "Event Scheduler" Etsy
listing: Event Calendar, Event Tracker, Event Search, Event Task Tracker, Event
Budget, Setup, and an all-in-one Dashboard). It was built directly from TrackerA's
**already-fixed** sync/auth/access-gate code — ported at the fix, not the bug — then
given its own domain (events/tasks/expenses, not tasks/habits/budget/meals/fitness)
and its own visual identity (see "Design" below). **TrackerA's own CLAUDE.md is the
canonical incident log for the Sheets sync architecture** (20+ documented, fixed
bugs: token caching, reauth/retry, push-before-pull, dirty-tracking persistence,
popup/timeout handling, per-tab write isolation, etc.) — this file doesn't repeat
that history since Event Planner inherited the fixes, not the bugs. If you're
touching `sync.ts`/`google/auth.ts`/`google/sheets.ts`, read TrackerA's CLAUDE.md
first for the *why* behind patterns here that might otherwise look like
over-engineering (no default on `allowInteractive`, per-tab dirty tracking instead
of a blanket push, the serialized push-chain, etc.) — those aren't precautions,
they're fixes for bugs that actually shipped once, elsewhere in this app family.

**Deliberately simplified vs. TrackerA**, not oversights:
- **No Calendar (Google Calendar) integration at all.** `google/auth.ts` only ever
  requests one scope (`drive.file`). TrackerA itself deferred Calendar reminder
  syncing to a future version because it's a Google-classified sensitive scope
  needing a full verification review for a feature that isn't core — Event Planner
  just never added it in the first place. Don't add `calendar.events` without
  discussing the verification trade-off first.
- **No recurrence engine.** Events are one-off, possibly multi-day date ranges
  (`startDate`..`endDate`), not recurring templates. There is no `Recurrences` tab,
  no lazy-materialization concept — a much simpler data model than TrackerA's Tasks/
  Recurrences split.
- **No Coach Tour / onboarding walkthrough.** TrackerA's spotlight-tour component
  was a deliberate, separately-built feature added after the base app shipped, not
  part of the core product — Event Planner doesn't have it yet. If it's wanted
  later, port TrackerA's `CoachTour.tsx` pattern; don't half-build a new one.
- **No "More" hub screen, no tab-bar pinning/rearranging.** TrackerA needed that
  because it has 16+ possible nav destinations that can't all fit in a bottom bar.
  Event Planner has exactly 5 primary destinations (Dashboard, Calendar, Events,
  Tasks, Budget) plus Settings/Privacy reached via the header avatar — all 5 fit
  directly in `TabBar.tsx`/`Sidebar.tsx` with no hide/pin logic at all. If a future
  version adds enough screens that this stops fitting, THEN port the pin/rearrange
  pattern — don't build it preemptively.

## Git — never auto-commit or push
Same rule as every sibling app. Do not run `git commit`, `git push`, or `git add`
toward a commit unless the user explicitly asks for it **in that same turn**. This
repo may be edited by more than one agent session at once — an unprompted commit can
silently sweep up and push another session's in-progress, unreviewed changes
together with yours. Build, typecheck, and test freely; leave the working tree
uncommitted for the user to review and push themselves. Being asked to commit once
does not carry over to later turns — ask again each time. **This repo was
intentionally left without a git repo at all as of this build** (mirroring
TrackerD's precedent) — `git init` is the user's call, not something to do
unprompted either.

## Version number — always real and visible
Same rule as every sibling app: never hardcode a version string. Version comes from
`src/lib/config.ts`'s `APP_VERSION` (from `package.json`, baked in via
`__APP_VERSION__` in `vite.config.ts`) and `BUILD_SHA` (CI's `VITE_COMMIT_SHA`, else
local git HEAD via `__LOCAL_COMMIT_SHA__`). Shown in the Settings screen footer —
must stay wired to these, never a literal string. `.github/workflows/deploy.yml`
auto-bumps the patch version to the CI run number before building — don't remove
that step if you set up real CI for this repo (none is configured against a live
remote yet; the workflow file is ready to go the moment this repo has one).

## What this is
A **static, phone-first PWA** cloning an "Event Scheduler" Etsy spreadsheet listing:
a multi-day-aware event calendar, an event tracker (list + rich detail/search view),
a task tracker scoped per-event or global, and a budget module (per-event and
overall budget-vs-actual plus an expense log). It is the *interface*; the user's own
**Google Sheet is the database** (optional — the app is fully usable, offline-first,
without ever connecting Google, exactly like every sibling app).

## THE DATABASE IS THE USER'S GOOGLE SHEET (when connected) — nothing else
Same principle as every sibling app: there is **no backend and no other database**.
The user's **Google Sheet is the single source of truth** once connected; IndexedDB
is an **offline cache** in front of it. Any persisted field must roundtrip through
`schema.ts` to a Sheet column, or it does not really exist.

**Not connected yet as of this build** — `LOCAL_MODE = true` in `src/lib/config.ts`
and no `.env` (no `VITE_GOOGLE_CLIENT_ID`, no `VITE_ACCESS_CODES`). To connect:
1. Create a Google OAuth **Web** client ID (owner-only step — needs a real Google
   Cloud Console project; an AI agent cannot mint one). `LOCAL_MODE` in `config.ts`
   is currently unused by the sync code itself (unlike TrackerA, nothing branches on
   it) — the real gate is simply whether `VITE_GOOGLE_CLIENT_ID` is set
   (`hasClientId` in `google/auth.ts`); flip `LOCAL_MODE` to `false` anyway to keep
   the flag meaningful for anyone reading this file later.
2. `cp .env.example .env` and set `VITE_GOOGLE_CLIENT_ID=…` and `VITE_ACCESS_CODES=…`.
3. **Declare the `drive.file` scope on the OAuth consent screen's Data Access page**
   — this is a SEPARATE step from creating the OAuth client and is NOT optional. See
   TrackerA's CLAUDE.md ("THE DATABASE IS THE USER'S GOOGLE SHEET" section) for the
   full story of a real, confirmed bug where skipping this step produced confusing
   "Google hasn't verified this app" / "sign-in didn't complete" symptoms that looked
   like code bugs but weren't. `drive.file` is non-sensitive and needs no
   verification review — that's the whole reason this app requests only that one
   scope and nothing else.
4. In-app: Settings → enter an access code → Connect Google → sync creates the sheet
   and pushes local data.

**Product principles (do not violate), same as every sibling app:**
1. No backend of ours — static hosting only. No server code.
2. User data lives in the user's Google Drive via Sheets API (`drive.file` scope only).
3. Offline-first: everything works from the IndexedDB cache; sync when online.
4. Phone-first, designed at ~390px — but dashboard-first, so desktop (≥900px,
   sidebar layout) must also look great.
5. Zero friction for buyers: the app opens straight to the Dashboard (no onboarding
   gate) and shows sample data (demo mode) on first run so it looks alive.

## Design: "First Love" (light) / "Old Flame" (dark)
Deliberately its own identity, not a recolor of a sibling's palette. Originally a
terracotta "printed invitation" theme called Marquee/Afterparty; re-themed
2026-07-24 (owner request: "a romantic first love design") to fit how much of this
app's real-world use is weddings and anniversaries. Went through three passes the
same day, worth knowing about since the failure mode between passes 1 and 2 is a
trap this file's earlier drafts fell into and a future editor could too:

1. **Palette swap only:** new values in `tokens.css`, same token NAMES, nothing
   else touched. Correctly rejected by the owner ("you only took the colors not
   the design"). A color swap alone leaves every actual SHAPE unchanged: the old
   Marquee identity's structural choices (a ticket-stub punched-circle divider,
   flat single-color buttons/cards, a plain flat page background) are about event
   admission and printed stubs, not romance, and no amount of recoloring them
   fixes that mismatch.
2. **Hand-designed shapes to go with the palette** (a heart-centered divider, a
   gold-diamond icon accent), with no concrete reference beyond a text
   description. Got as far as "no need for hearts" before the owner instead
   supplied a complete HTML/CSS mockup to build FROM, rather than continuing to
   iterate blind. **General rule: once a concrete visual reference exists, treat
   it as ground truth over an earlier from-scratch guess.** Don't keep any prior
   invented motif (the heart divider, the gold diamond) just because it was
   already built; if the reference doesn't have it, drop it.
3. **Ported from the owner-supplied reference** (`first-love-dashboard.html`, a
   full Dashboard mockup, delivered via the Downloads folder). This is the
   current, real state of the theme, described below. **If this file and the
   actual CSS ever disagree, trust the CSS** and treat this section as possibly
   stale prose, same general rule as everywhere else in this file.

**The palette:** blush, lilac and peach clouds, not embers. Airy, almost-white
translucent surfaces over a soft 3-stop gradient (`--bg-grad`, see
`tokens.css`), a pink primary accent (`--accent`) paired with a lavender
secondary (`--accent-2`), both defined at a deep/readable strength since
`--accent` is used as text/icon color throughout, not just fills; soft pastel
tints for backgrounds live in `--accent-soft`/`--accent-2-soft`. Category
pastels and the priority ramp were re-hued into the same family (soft pinks,
lilacs, peaches, sage, teal) rather than left in the old rose/gold register.
**No literal hearts anywhere in the UI** (owner call, 2026-07-24, after pass 2's
heart divider) even though the reference mockup itself DOES use floating heart
glyphs in its hero art: the hero's floating decoration is deliberately built as
plain soft dots/circles instead (`HeroArt` in `DashboardScreen.tsx`, `.hero-art`
in `base.css`) and the app icon is a plain gradient monogram with no accent
glyph at all. Keep it that way unless the owner asks otherwise.
- **A serif display face for headings** (`--font-display`, a system-serif stack
  including "New York", no webfont fetch) paired with a system-sans body face.
  No sibling app uses a serif anywhere; this is the one typographic signature
  unique to this app, and it reads even more like a love letter under this
  palette than it did before.
- **Rounder and larger than the old theme on purpose:** `--r-card` is 26px,
  `--r-input` 16px (`tokens.css`) for every card/input/sheet in the app. A big
  soft corner reads calmer and more keepsake-like than a productivity-app radius.
- **A dual shadow recipe** (`--shadow`/`--shadow-sm` in `tokens.css`): a tight
  pink-tinted contact shadow plus a big, soft lavender ambient bloom, instead of
  a single flat drop shadow. This alone is most of why cards read as "floating"
  rather than "boxed." Do not collapse it back to a single-layer shadow.
- **One recurring two-hue gradient (pink into lavender)** is the app's signature
  fill, used everywhere something needs to feel like the "primary" action or
  state rather than a flat tint: `.btn--primary`, `.chip--on`, `.avatar`, the
  sidebar's active-nav pill (`.sidebar__item--on`), and the Dashboard mini
  calendar's "today" marker. Reuse this exact pairing for anything new in the
  same role rather than inventing a different gradient.
- **The sidebar is frosted glass, not a flat panel:** `background:
  color-mix(in srgb, var(--surface) 72%, transparent)` plus
  `backdrop-filter: blur(20px)`, the same translucent-blur technique the mobile
  `.appbar`/`.tabbar` already used before this re-theme. `.card` stays a plain
  opaque-ish surface (no blur) with `overflow: hidden` so its border-radius
  correctly clips content, matching the reference mockup.
- **The Dashboard's `.hero` card** (new in this pass, `base.css` + top of
  `DashboardScreen.tsx`) bundles the page title, subtitle, tour button, and the
  four stat tiles into one big soft card with floating dot decoration, replacing
  the old plain-text header + separately-floating stat cards. Inside the hero,
  stats render as one unified strip with internal dividers (`.stat`), not four
  separately-shadowed `.card`s. Every OTHER screen keeps the plain
  `.page-title`/`.page-sub` header; the hero treatment is Dashboard-specific
  because that's the only screen the reference mockup covers.
- **`PageTourButton` uses a dedicated `.tour-btn` style** (soft accent-bordered
  pill, accent-colored text) instead of a generic `.btn--ghost`, matching the
  reference mockup's tour button, and this applies globally since the component
  is shared across every screen.
- **The app icon and every `<img>` brand mark** (Sidebar/Header/TabBar, all
  pointing at the same `favicon-96x96.png`) are a plain rounded-square gradient
  monogram, pink into lavender, an italic serif white "E", no secondary accent
  shape. Regenerated via a local SVG source rasterized with `qlmanage` and
  resized with `sips`, no source kept in the repo (see git history for the exact
  commands if it needs regenerating again). The three `<img>` tags got a
  matching soft accent-colored `box-shadow` (`.sidebar__brandimg`/
  `.appbar__brandimg`/`.tabbar__brand`) so the flat PNG picks up the same "glow"
  the live gradient elements have.
- **The Calendar screen's multi-day event bars** (`src/lib/calendarLayout.ts` +
  `.calweek`/`.calcell`/`.calbar*` classes in `base.css`) are this app's
  signature, novel visualization: a real desk-calendar-style Gantt view with
  stable per-event lanes, built with a plain greedy interval-packing algorithm,
  no chart library. Keep `tests/calendarLayout.test.ts` green if you touch it.
- Same owner preferences as every sibling app: **no emojis in the UI**, icons only
  (lucide-react via `src/components/icons.tsx`), **charts are CSS/JS only** (no SVG,
  no chart library — `src/components/Charts.tsx`), **never `window.confirm()`/
  `window.alert()`** (use `confirmDialog()`/`useToast` instead), and a genuinely
  destructive Danger Zone action gets `LockGatedButton`
  (`src/components/LockGatedButton.tsx`), not a plain danger button.

## Access-code gate — soft by design, throttled from day one
`src/lib/access.ts` is ported directly from TrackerA's ALREADY-FIXED version (see
TrackerA's CLAUDE.md, "Access-code gate" section, for the full incident history of
why this exists and its inherent limits) — `tryUnlock()`'s escalating lockout
(5 free attempts, then 30s, then an exponential wall in hours capped at 24h,
persisted to both localStorage and IndexedDB) shipped correct from the start here,
never bypassed. **`stores/bootstrap.ts`'s `activate(code)` must always go through
`tryUnlock()`, never call `isValidAccessCode()` directly** — same rule as every
sibling app; it now returns `{ ok, retryAfterMs? }` instead of a plain boolean so
the UI can show a real wait time. This is still not, and cannot be, brute-force-proof
from a static site — see TrackerA's CLAUDE.md for why that ceiling is architectural,
not a bug to fix here.

## Tech stack (fixed — do not substitute)
- Vite + React 18 + TypeScript, SPA, hash router (no react-router), deploys as
  static files.
- Hand-written CSS with design tokens (`src/styles/tokens.css` + `base.css`). No
  Tailwind, no UI kit.
- **Zustand** for state (one store per collection, via the `createCrud` factory in
  `src/stores/crud.ts`). **date-fns** for dates (all date math goes through
  `src/lib/dates.ts`). **idb** for IndexedDB. **lucide-react** for icons.
- Google: raw REST + Google Identity Services (no gapi client).
- Vitest for the pure logic (`calendarLayout`, `schema`).

## Architecture map
```
src/
  lib/
    types.ts          domain types: EventItem, EventTask, Expense, Priority (6
                       levels), TaskStatus (6 levels), Settings + DEFAULT_* lists
    schema.ts          SINGLE SOURCE OF TRUTH for Sheet tabs/columns + row (de)serializers
    dates.ts           ALL date math (plain ISO yyyy-mm-dd; no times except Event
                       start/end time, a free "HH:mm" field)
    calendarLayout.ts  the multi-day event bar lane-packing algorithm (see Design above)
    db.ts               IndexedDB (one object store per collection: events, eventTasks, expenses)
    sync.ts             Sheets pull / push-all / debounced flush / connect (ported from
                       TrackerA's fixed version — 3 sync tabs instead of 16)
    google/
      auth.ts           GIS token client (drive.file scope ONLY, no Calendar)
      sheets.ts         REST wrapper: create / batchGet / writeTab (clear+update)
    ui.ts               category colors, priority colors, event-status colors, money/pct formatters
    sample.ts           first-run sample data (a realistic slate of events/tasks/expenses)
    access.ts           Etsy access-code gate + brute-force throttle (see above)
    demo.ts             demo-mode flag (memory-only sample data, never persisted)
    config.ts           DB_NAME/VERSION, LOCAL_MODE flag, APP_VERSION/BUILD_SHA
  stores/                zustand: useEvents, useEventTasks, useExpenses (all via crud.ts),
                       useSettings, useSync, useConfirm, useToast, useInstall,
                       bootstrap.ts (hydrate + seed + migrate)
  components/            ProgressRing, Charts, BottomSheet, Chip, Segmented, Checkbox,
                       EmptyState, CountUp, TabBar, Sidebar, Header, LockGatedButton,
                       DemoBanner, ReconnectBanner, UpdatePrompt, icons.tsx
  features/
    dashboard/          DashboardScreen — stat tiles, mini calendar, charts, upcoming lists
    calendar/           CalendarScreen — the signature multi-day-bar month calendar
    events/             EventsScreen (Event Tracker list), EventSheet (add/edit form),
                       EventDetailScreen (Event Search — full detail + per-event tasks/expenses)
    tasks/               TasksScreen (global Task Tracker), TaskSheet
    budget/               BudgetScreen (global Event Budget + expense log), ExpenseSheet
    settings/            SettingsScreen — Setup lists, Google connect, access code, Danger Zone
    privacy/             PrivacyScreen
  nav.tsx                 SINGLE nav config consumed by Sidebar + TabBar (5 fixed items, see above)
  router.ts               tiny hash router (Route union type lists every route)
  App.tsx                 shell: Sidebar (desktop) + Header + <main> + TabBar (mobile)
tests/                    calendarLayout / schema
```

## Google Sheet as database
- `schema.ts` defines every tab + column order. Row 1 is an app-written header.
- Records keyed by `id` (col A, nanoid) — NEVER by row position. Tolerate extra
  user columns, reordered/blank rows.
- Tabs: **Settings** (key/value, carries the access code cross-device), **Events**,
  **Task Tracker** (EventTask), **Expenses**. Only 3 tabs actually sync per-collection
  data — a much smaller surface than TrackerA's 16, so the per-tab dirty-tracking
  machinery ported from TrackerA is arguably more headroom than this app currently
  needs, but it's kept because it's the correct, already-debugged pattern, and this
  app WILL grow (see TODO.md).
- Setup lists (`Settings.categories`, `eventTypes`, `marketRegions`, `states`,
  `owners`, `eventStatuses`, `eventStatusIcons`) are **local-only, per device** —
  same as TrackerA's `categories`/`categoryColors`, they live in IndexedDB's `kv`
  store via `useSettings`, not in a synced Sheet tab. If two devices connect to the
  same Sheet with different Setup lists, each keeps its own local list; only the
  Event/Task/Expense rows themselves (which reference those lists by plain string,
  not by id) are shared. This is a deliberate simplification carried over from
  TrackerA's identical `categories` design, not an oversight — see TrackerA's
  CLAUDE.md if this ever needs to become a synced, shared list instead.
- Event `status` and Task `status` are **plain strings on the row**, not enum
  indices — an event tagged "Confirmed" stays readable in the raw Sheet even if a
  buyer later renames or removes that status from their local Setup list (it just
  falls back to a generic icon/hash color in the UI, never crashes or gets orphaned).
- Sync (`sync.ts`) is a direct, scope-reduced port of TrackerA's fixed sync engine:
  pull = batchGet all 3 tabs → replace IndexedDB + stores. Push is per-tab dirty
  tracking (persisted across a reload), a serialized push chain (pushAll/pushDirty
  can never race each other), per-tab write isolation in the shared write loop
  (`writeAllTabs`, one broken tab can't starve the others), push-before-pull on
  reconnect (never blindly overwrite local with a possibly-stale Sheet), and
  `markDisconnected()` as a synchronous first line before any slow async cleanup.
  **Do not "simplify" any of this away** — every one of these exists because the
  naive version of it shipped a real, confirmed data-loss bug in TrackerA first. See
  TrackerA's CLAUDE.md for the individual incident write-ups if you need the *why*.

## Data flow for a mutation
store action → update in-memory state → `db.put(...)` (IndexedDB) → `useSync.touch(collection)`
→ if connected, debounced `pushDirty()` pushes just that tab to Sheets; else flash "Saved".

## Conventions
- Match the surrounding code's style. New screens: `features/<name>/<Name>Screen.tsx`,
  add the `Route` to `router.ts`, an entry to `nav.tsx` (if it's a primary
  destination — Settings/Privacy deliberately aren't in `nav.tsx`, see App.tsx/
  Header.tsx/Sidebar.tsx for how they're reached instead), and a case in `App.tsx`.
- New persisted collection: add to `types.ts`, `schema.ts` (headers + serializers),
  `db.ts` (object store + `ALL_COLLECTIONS`, bump `DB_VERSION`), a store (via
  `createCrud` in `crud.ts` unless it needs bespoke logic), `bootstrap.ts`
  (load + seed), and `sync.ts` (`tabValues`/`COLLECTION_TAB`/`pull`).
- Icons: import from `components/icons.tsx`. User-pickable icons (Event Status Setup
  list) live in `NAMED_ICONS`.
- Money via `ui.ts`'s `money()`. Category colors via `categoryColor()`, priority via
  `PRIORITY_COLOR`/`PRIORITY_LABEL`, event status via `eventStatusColor()`.
- **Any "take the user to the thing they just did X to" action must carry that
  thing's id, not just a screen name.** See `EventDetailScreen`'s use of
  `routeQuery().get("id")` — landing on a screen with no id context looks broken the
  moment there's more than one thing on that screen. Pass `{ id }` via
  `navigate(route, query)`, read it back with `routeQuery()` in the target screen.
- **Never use the native `window.confirm()`/`window.alert()`** — see "Owner
  preferences" above. Use `confirmDialog()` (`src/stores/useConfirm.ts`) and
  `useToast` (`src/stores/useToast.ts`).

## Commands
```
npm install
npm run dev        # dev server on port 5518 (fixed — see vite.config.ts)
npm test           # vitest — keep green before finishing a phase
npm run build      # static output in dist/
npx tsc --noEmit   # typecheck (must be clean)
```

## Quality gates before calling a phase done
1. `npm test` green (calendarLayout, schema). 2. `tsc --noEmit` clean.
3. `npm run build` succeeds. 4. No emojis in UI, no SVG/library charts.

## Status / roadmap
See `TODO.md`. Google Sheets sync code is complete but the app is **not connected
yet** — `LOCAL_MODE = true` and no `.env`. Connecting is the top-priority open task,
same as every sibling app was at this stage (see "THE DATABASE IS THE USER'S GOOGLE
SHEET" above).
