# Event Planner

A static, phone-first PWA event scheduler. Plan events (weddings, concerts,
corporate summits, conferences...), track their tasks, and log their budgets —
all synced to a Google Sheet that lives in **your own** Google Drive. No account,
no backend, no server of ours.

## Features

- **Calendar** — a month view where multi-day events render as continuous colored
  bars in stable lanes, like a real desk calendar.
- **Events** (Event Tracker) — a searchable, filterable list of every event, with a
  rich detail view (Event Search) showing everything about one event in one place.
- **Tasks** (Event Task Tracker) — tasks scoped to a single event or viewed globally
  across all of them.
- **Budget** — per-event and overall budget-vs-actual, plus an itemized expense log.
- **Dashboard** — stat tiles, a mini calendar, and charts across category, priority,
  status, type, and budget.
- Fully usable offline. Optionally connects to Google Sheets so your data lives in
  your own Drive, on every device.

## Getting started

```
npm install
npm run dev
```

Opens on `http://localhost:5518`. The app works immediately with sample data —
nothing to configure to try it out.

## Connecting Google Sheets (optional)

1. Create a Google OAuth **Web** client ID in Google Cloud Console.
2. `cp .env.example .env` and fill in `VITE_GOOGLE_CLIENT_ID` and
   `VITE_ACCESS_CODES`.
3. Declare the `drive.file` scope on the OAuth consent screen's Data Access page —
   see `CLAUDE.md` for why this step is easy to miss and what it looks like when you
   do.
4. In-app: Settings → enter an access code → Connect Google.

## Tech

Vite + React + TypeScript, Zustand, IndexedDB (`idb`), hand-written CSS (no
Tailwind/UI kit), CSS-only charts (no chart library), Google Identity Services +
raw Sheets REST (no `gapi`).

See `CLAUDE.md` for the full architecture map and the reasoning behind the sync
engine's design.
