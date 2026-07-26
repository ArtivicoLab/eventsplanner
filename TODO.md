# TODO / Roadmap

## v1.0 — ship blockers
- [ ] Create a real Google OAuth Web client ID and set `.env` (owner-only step —
  see CLAUDE.md's "THE DATABASE IS THE USER'S GOOGLE SHEET" section).
- [ ] Declare the `drive.file` scope on the OAuth consent screen's Data Access page.
- [ ] Set real `VITE_ACCESS_CODES` for the Etsy listing.
- [ ] Design/commission real app icons (the current icon set is a placeholder
  monogram generated locally — functional, on-brand, but not a final asset).
- [ ] `git init` this repo (deliberately left undone — see CLAUDE.md's Git section)
  and wire up `.github/workflows/deploy.yml` against a real GitHub Pages target
  (set `secrets.VITE_GOOGLE_CLIENT_ID` / `secrets.VITE_ACCESS_CODES`).
- [ ] Manual pass through every screen on a real phone (this build has been
  typechecked/tested/built but not yet clicked through end-to-end on-device).

## v1.1 — backlog, deliberately deferred (see CLAUDE.md for why each was skipped)
- [ ] Coach Tour / first-run spotlight walkthrough (TrackerA has one; Event Planner
  doesn't yet — port the pattern rather than rebuilding it from scratch).
- [ ] Consider syncing the Setup lists (categories/types/states/owners/statuses)
  through the Sheet instead of keeping them local-only-per-device, if multi-device
  Setup drift turns out to matter to real users.
- [ ] Calendar (Google Calendar) reminders for upcoming events/tasks — deliberately
  not requested at all yet; needs a real product decision plus Google verification
  review for the `calendar.events` scope before it's worth adding.
- [ ] A "More" hub / pinnable tab bar, only if/when the nav grows past 5 primary
  destinations (Goals? Vendors? Guest lists?) — don't build the infrastructure
  before there's something that needs it.
- [ ] Recurring events (an annual gala, a monthly meetup) — the current data model
  is one-off date ranges only; a recurrence engine is a real architecture decision,
  see TrackerA's `recurrence.ts` if this becomes a priority.

## Known limitations (by design, not bugs)
- The access-code gate is a soft, client-side UX gate, not real license enforcement
  — see CLAUDE.md's "Access-code gate" section.
- Setup lists are per-device; only Event/Task/Expense rows themselves are shared via
  the Sheet.
