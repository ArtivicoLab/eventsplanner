# TODO / Roadmap

## Confirmed bugs — full-codebase audit, 2026-07-26
Found by an 8-dimension automated review (sync/auth/access-gate, data layer, stores,
shared UI components, dashboard/calendar, events/tasks, budget/settings/privacy,
guests/seating) with every finding independently re-verified against the actual code
before being listed here. Ranked most-impactful first.

- [x] Fix `resetEverything()`'s "Erase everything" button silently wiping Settings
  (categories, owners, currency, activation/access code) beyond what the confirm copy
  promises — `db.wipeAll()` clears the shared `kv` store too, and `useSettings`'s
  in-memory state is never reset/reloaded, so the screen shows stale data until next
  load, then silently resets to factory defaults and de-activates the app
  (src/stores/bootstrap.ts).
  **How to fix:** either scope `wipeAll()` to exclude the settings/activation/lockout
  keys in `kv`, or — if a full wipe really is intended — update the confirm dialog's
  copy to say so explicitly, and reset/reload `useSettings`'s in-memory state
  synchronously right after the wipe so the UI doesn't show stale data before the
  next load.
  **Fixed 2026-07-26:** added `db.wipeCollections()` (clears only
  events/eventTasks/expenses/rooms/guests, leaves `kv` alone); `resetEverything()`
  now calls that instead of `wipeAll()`. Updated the confirm-dialog and Danger Zone
  copy to accurately list what's erased (events, tasks, expenses, seating charts,
  guests) and note that Quick Setup and the access code are kept.
- [x] Add `TAB.Meta` ("Settings") to `SYNC_TABS` — it's never created in the user's
  Sheet, so `syncAccessCode()`'s writes/reads both 400 and are silently swallowed,
  making cross-device access-code sync (the whole point of `relink()`) completely
  non-functional (src/lib/sync.ts:80).
  **How to fix:** add `TAB.Meta` to `SYNC_TABS` (or otherwise ensure it wherever
  `ensureTabs()`/`createSpreadsheet()` run) so `writeMetaKey()`/`readMetaTab()` have
  a real range in the Sheet to target.
  **Fixed 2026-07-26:** added a separate `ALL_TABS` (`[...SYNC_TABS, TAB.Meta]`) used
  only where tabs get CREATED (`ensureTabs`/`createSpreadsheet` in `connect()`,
  `createNewSheet()`, `relink()`) — kept out of `SYNC_TABS` itself since Meta isn't a
  per-collection tab and the generic push loop would clobber it.
- [x] Fix `confirmDialog()`'s single `current` slot silently overwriting a
  still-pending request when called twice in quick succession — the first caller's
  Promise never resolves, permanently hanging whatever action (e.g. a delete) was
  awaiting it (src/stores/useConfirm.ts).
  **How to fix:** queue pending confirm requests instead of one overwritable slot —
  resolve the current one before showing the next, or explicitly resolve a
  superseded request to `false` instead of silently dropping its `resolve` callback.
  **Fixed 2026-07-26:** added a `queue` array to `useConfirm`; `request()` pushes
  onto it instead of overwriting `current` when one's already showing, and
  `resolve()` pops the next queued request into `current` afterward.
- [x] Fix `layoutMonthEvents`'s "longer events first" lane sort using
  `String.localeCompare` (returns only -1/0/1, not a magnitude) to compare event
  span — it can't distinguish a 2-day from a 20-day event, so long multi-day events
  can get bumped into the "+N" overflow ahead of much shorter ones, sometimes with
  no real scheduling conflict (src/lib/calendarLayout.ts:50).
  **How to fix:** compute actual duration (e.g. `differenceInCalendarDays(endDate,
  startDate)` via date-fns, consistent with the rest of the codebase's date-math
  conventions) and sort descending by that value instead of comparing date strings
  with `localeCompare`.
  **Fixed 2026-07-26:** now sorts by `daysBetween(startDate, endDate)` (dates.ts's
  own date-fns wrapper) descending, a real numeric span instead of a -1/0/1 compare.
  That alone changed processing order enough to break "reuses a lane once its
  previous occupant has ended" (a short event now sometimes gets processed after
  an unrelated longer one it doesn't overlap), so lane assignment was also changed
  from tracking only each lane's most-recent occupant to checking a new event
  against every occupant already in a candidate lane — correct regardless of
  processing order. All 29 existing tests still pass.
- [x] Fix the "happening now" banner (`nowEvent`) computing `today` inside a
  `useMemo` keyed only on `[sorted]` — it goes stale across a midnight rollover (any
  non-CRUD re-render skips recompute) and shows yesterday's event as current until
  the user adds/edits/deletes something; mirror TrackerA's `useDueToday` fix
  (reactive `today` state refreshed on `visibilitychange`)
  (src/features/events/EventsScreen.tsx:65).
  **How to fix:** track `today` as reactive state (refreshed on a `visibilitychange`
  listener, matching TrackerA's `useDueToday` fix) and include it in the memo's
  dependency array instead of computing it once inside the memo body.
  **Fixed 2026-07-26:** added `today` as reactive state, refreshed via
  `visibilitychange`/`focus` listeners, and put it in `nowEvent`'s memo deps
  alongside `sorted`.
- [x] Fix room-drag Y-axis clamp mismatch between the live preview (`onMove`,
  [8,92]) and the committed position (`onUp`, [10,88]) — dragging a table near the
  top/bottom edge makes it visibly snap ~2-4% the instant it's released
  (src/features/seating/SeatingScreen.tsx:246).
  **How to fix:** use the same clamp range (either [8,92] or [10,88]) in both
  `onMove` and `onUp` so the live preview and the committed position always agree.
  **Fixed 2026-07-26:** extracted shared `ROOM_X_CLAMP`/`ROOM_Y_CLAMP` ([6,94] /
  [8,92]) constants used by both `onMove` and `onUp`.
- [x] Fix `nextRoomPosition()`'s cascade grid wrapping every 9 rooms via `% 3` on
  the row index — the 10th room added one-at-a-time via "+ Add Room" lands exactly
  on top of the 1st, stacked and visually indistinguishable
  (src/features/seating/SeatingScreen.tsx:40).
  **How to fix:** drop the modulo wrap (or expand the grid, or offset each
  wrap-around pass) so the placement keeps advancing past 9 rooms instead of
  repeating.
  **Fixed 2026-07-26:** each full 3x3 cycle past the 9th room now nudges position
  by a growing offset (4 distinct nudges before an exact repeat), so the 10th room
  no longer lands exactly on the 1st.
- [x] Wire up LiveTicker's `data-tour="live-ticker"` attribute to a CoachTour step —
  no step targets it, so mobile users never get the Live feed explanation that
  desktop users get via the "sidebar-live" step (src/components/LiveTicker.tsx:42).
  **How to fix:** add a CoachTour step targeting `"live-ticker"` (shown only when
  LiveTicker is actually rendered, i.e. mobile width), or remove the unused
  `data-tour` attribute if the explanation was deliberately meant to stay
  desktop-only.
  **Fixed 2026-07-26:** changed LiveTicker's own `data-tour` to `"sidebar-live"` (the
  same key the desktop Sidebar's feed already uses) instead of adding a second step —
  mirrors the existing pattern nav items use to share one step between their
  Sidebar/TabBar variants; `CoachTour`'s `findTarget()` already picks whichever one
  has real size at the current width.

## Path to all-A grades — 6-dimension grade report, 2026-07-26
From an automated grade audit (design system, sync/auth/access-gate fidelity, feature
completeness, code quality, test coverage, accessibility/UX), every issue rated major
independently re-verified before being listed here. Overall grade was **B-**; current
per-dimension grades and what's needed to close each to an A are below. None of these
are critical/data-loss bugs — see "Confirmed bugs" above for those — this section is
specifically the gap between "solid" and "excellent."

### Accessibility, Responsiveness & UX Polish — C → A (biggest gap)
- [ ] Make the primary click target keyboard-reachable on 4 screens — `TasksScreen.tsx:286`,
  `GuestsScreen.tsx:367`, `EventsScreen.tsx:238` (`.evcard__body`), and
  `CalendarScreen.tsx:308` (`.calbar`) are all plain `onClick` divs. Add
  `role="button" tabIndex={0} onKeyDown` (Enter), matching the already-correct pattern
  in `BudgetScreen.tsx:182-188`. Single biggest, cheapest lever on this grade.
- [ ] Add visible `:focus-visible` styling app-wide — `.searchbar__input` sets
  `outline: none` (`base.css:1219`) with no replacement, and only one `:focus` rule
  exists in the entire stylesheet (inputs only, line 667). Audit `.btn`/`.icon-btn`/
  `.chip`/`.tabbar__btn`/`.sidebar__item`.
- [ ] Fix `--accent` (`tokens.css:96`, `#d9577f`) failing WCAG AA contrast (~3.4:1
  against `--bg` in light mode, below the 4.5:1 threshold) despite being used as small
  text/icon color throughout (e.g. `.tabbar__btn--active`, date-chip labels). Darken
  for light mode, or restrict small-text use to bold/large contexts.
- [ ] Fix `BottomSheet.tsx:56` claiming `aria-modal="true"` without actually trapping
  Tab focus inside the sheet.
- [ ] Bump touch targets under the ~44px minimum: `.seat` (30px), `.icon-btn` (32px),
  avatar/header-chip closers (34px) — `base.css:1465`.
- [ ] Use the shared `EmptyState` component for Calendar's empty state
  (`CalendarScreen.tsx:250` is a plain text string, inconsistent with every other
  list screen).
- [ ] Add `role="navigation"`/`aria-label` to the desktop `<aside>` in `Sidebar.tsx:70`
  (TabBar already has `<nav aria-label="Primary">`); use `aria-label` (not just
  `title`) on Seating's empty-seat buttons (`SeatingScreen.tsx:369`).

### Test Coverage & Correctness — C+ → A
- [ ] Add unit tests for `sync.ts`'s dirty-tab persistence (lines 99-124), the
  serialized push chain (174-181), per-tab write isolation in `writeAllTabs`
  (231-244), and the retry backoff math (515-550) — the exact logic CLAUDE.md calls
  out as fixes for real, previously-shipped data-loss bugs, currently with zero
  coverage. All four are pure enough to test without a network/Google mock.
- [ ] Add unit tests for `access.ts`'s `lockDurationMs()` (99-104) and
  `reconciledThrottle()` (83-94) — boundary tests for attempt 5 vs. 6 vs. 7 and the
  24h cap, plus the localStorage+IndexedDB merge.
- [ ] Add a Room round-trip test to `schema.test.ts` (`roomToRow`/`rowToRoom`,
  `schema.ts:109-116`) — the only one of 5 synced collections never round-tripped,
  leaving its `shape`/`seats` fallback defaults untested.
- [ ] Add a test for `sync.ts`'s blank-row filtering (`parseRows`, ~268-273), which
  backs the "tolerates reordered/blank rows" claim but is itself untested.
- [ ] Update CLAUDE.md's architecture map / "Tech stack" section to mention
  `seating.ts`, `SeatingScreen.tsx`, and `tests/seating.test.ts` (currently the
  largest suite at 11 tests, but entirely absent from the docs) — this dimension
  was dinged for documentation drift, not only missing tests.

### Design System Compliance ("First Love"/"Old Flame") — B- → A
- [ ] Remove the literal heart icon at `Sidebar.tsx:118` — `<IconHeart size={16} />`
  renders unconditionally on the desktop Privacy nav row, a direct, visible violation
  of "no literal hearts anywhere in the UI." Swap for a non-heart icon.
- [ ] Give dark mode its own dual-layer shadow recipe — `tokens.css:134` and the
  duplicated `auto`/dark-mode branch at 182-183 use flat single-layer black
  (`0 10px 30px rgba(0,0,0,.5)`), not the tinted pink-contact + lavender-bloom recipe
  the light theme correctly implements at line 109.
- [ ] Reconsider `heart: Heart` in `NAMED_ICONS` (`icons.tsx:116`) — a second, opt-in
  path for a literal heart to appear via custom Event Status icons, contradicting the
  blanket rule even though it's user-chosen rather than forced.

### Feature Completeness — B+ → A
- [ ] Fix `TaskSheet.tsx:66` (`canSave` requires non-empty `eventId`) and its event
  `<select>` (106-118, no "no event" option) so a genuinely global task can actually
  be created — currently impossible, contradicting CLAUDE.md's own "task tracker
  scoped per-event or global." Add a General/no-event option; make
  `EventTask.eventId` optional.
- [ ] Reconcile the nav-destination count: `nav.tsx:16` has grown to 7 entries
  (added `seating`, `guests`) vs. CLAUDE.md's documented "exactly 5." Either fold
  this into the already-tracked "More hub" backlog item below, or update CLAUDE.md
  now to describe the real 7-item nav.
- [ ] Resolve CLAUDE.md's internal self-contradiction on Coach Tour — the
  "Deliberately simplified" section still reads as "doesn't have it yet" in one
  spot despite Coach Tour having shipped (see the struck-through v1.1 item above);
  make the file internally consistent, not just accurate in one section.

### Sync / Auth / Access-Gate Fidelity — A- → A
- [ ] Route `sync.ts:335`'s `syncAccessCode()` (reads the access code back from the
  Sheet's Meta tab) through `tryUnlock()` instead of calling `isValidAccessCode()`
  directly — it's the one place that bypasses the escalating lockout. Mitigated by
  requiring a fresh OAuth click per attempt, but either close the gap or write down
  the accepted risk explicitly.

### Code Quality — A- → A
- [ ] Remove confirmed dead code: unused `suspendSync()`/`resumeSync()` exports
  (`sync.ts:160`), unused `Columns` chart component (`Charts.tsx:176`), 5 unused date
  helpers + 3 unused re-exports (`dates.ts:52`), unused `APP_NAME` (`config.ts:7`,
  string hardcoded elsewhere instead), unused `SCHEMA_VERSION` (`schema.ts:9`),
  unused `currentToken()` (`google/auth.ts:196`), 10 unused icon aliases
  (`icons.tsx:92`).
- [ ] Have `GuestsScreen.tsx:256` and `SeatingScreen.tsx:32` reuse `ui.ts`'s exported
  `pct()`/`hashColor()` instead of reimplementing them inline, leaving the real
  helpers unused.

## v1.0 — ship blockers
- [x] ~~Create a real Google OAuth Web client ID and set `.env`~~ — done 2026-07-26;
  `VITE_GOOGLE_CLIENT_ID` is set in `.env` (gitignored, not pushed).
- [ ] Declare the `drive.file` scope on the OAuth consent screen's Data Access page
  (owner-only step, Google Cloud Console — still open).
- [x] ~~Set real `VITE_ACCESS_CODES` for the Etsy listing~~ — done 2026-07-26; `.env`
  has a real code, no longer the placeholder.
- [ ] Design/commission real app icons (the current icon set is a placeholder
  monogram generated locally — functional, on-brand, but not a final asset).
- [x] ~~`git init` this repo~~ — done (owner's own call); `git log` shows real
  commit history now. Still open: wire up `.github/workflows/deploy.yml` against a
  real GitHub Pages target (set `secrets.VITE_GOOGLE_CLIENT_ID` /
  `secrets.VITE_ACCESS_CODES`).
- [ ] Manual pass through every screen on a real phone (this build has been
  typechecked/tested/built but not yet clicked through end-to-end on-device).

## v1.1 — backlog, deliberately deferred (see CLAUDE.md for why each was skipped)
- [x] ~~Coach Tour / first-run spotlight walkthrough~~ — shipped
  (`src/components/CoachTour.tsx` + `useCoachTour.ts`), stale item kept struck
  through rather than silently deleted; see CLAUDE.md, updated 2026-07-26.
- [ ] Consider syncing the Setup lists (categories/types/states/owners/statuses)
  through the Sheet instead of keeping them local-only-per-device, if multi-device
  Setup drift turns out to matter to real users.
- [ ] Calendar (Google Calendar) reminders for upcoming events/tasks — deliberately
  not requested at all yet; needs a real product decision plus Google verification
  review for the `calendar.events` scope before it's worth adding.
- [ ] A "More" hub / pinnable tab bar — nav has grown to 7 primary destinations
  (Dashboard/Calendar/Events/Seating/Guests/Tasks/Budget) plus Settings/Privacy via
  the header avatar; still fits directly in the tab bar/sidebar with no pin/hide
  logic, but this is the item to revisit first if anything else gets added.
- [ ] Recurring events (an annual gala, a monthly meetup) — the current data model
  is one-off date ranges only; a recurrence engine is a real architecture decision,
  see TrackerA's `recurrence.ts` if this becomes a priority.

## Known limitations (by design, not bugs)
- The access-code gate is a soft, client-side UX gate, not real license enforcement
  — see CLAUDE.md's "Access-code gate" section.
- Setup lists are per-device; only Event/Task/Expense rows themselves are shared via
  the Sheet.
