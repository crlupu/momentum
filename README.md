# Momentum — Progress Tracker

A personal progress system in one page: goals, daily and recurring tasks,
fitness, nutrition, reading and progress charts. Light theme by default with a
dark-mode switch. Data syncs across devices via Firebase (Firestore + Google or
email/password sign-in), and falls back to local-only mode until Firebase is
configured. Works offline as an installable PWA.

Stack: Next.js 15 (static export) · React 19 · Carbon (`@carbon/react`, Sass) ·
Tailwind CSS 4 · next-themes · Firebase v12 · dnd-kit · react-icons.

## Sections

Each section has its own page, reached from the menu (☰). Goals is the home
page. `components/sections.ts` is the single source of truth for each
section's id, title, path and numbered index.

| Section | Path | What it holds | Main components |
| --- | --- | --- | --- |
| Goals | `/` | Goals with subtasks, grouped into paths | `GoalsView`, `PathsView` |
| Tasks | `/tasks` | Daily todos and recurring tasks (daily / weekly / biweekly / monthly) | `TodoList`, `RecurringList` |
| Fitness | `/fitness` | Workouts built from blocks of exercises, a live workout player (timed circuits included), weight and cardio logs | `WorkoutsView`, `CircuitPlayer`, `WeightTracker`, `WorkoutVolumeChart` |
| Nutrition | `/nutrition` | Calories with meal tags and a weekly budget, protein and fibre against targets | `CaloriesTracker`, `MacroTracker` |
| Books | `/books` | Reading tracks: queues, phases, daily logging, notes, pace and history | `Books`, `components/books/*` |
| Progress | `/progress` | Completion charts and a month calendar | `Charts` |
| Log | `/log` | History of completed tasks, workout sessions and cardio | `CompletionLog` |
| Configuration | `/configuration` | Categories, groups, recurring tasks, workouts, meal tags, calorie budget, macro targets | `Forms`, `ConfigCard` |

### Books (reading tracks)
The logic lives in `lib/reading.ts` (pure functions); the UI is in `components/books/`.

- **Tracks** are lanes of reading (defaults: Technical, Non-technical, Slow lane). Each has
  a limit on how many books can be open at once, a daily page target, a time slot and a
  number of rest days per week. Starting a book in a full track asks you to pause the
  current one, queue the new one next, or cancel.
- **Statuses** are `queued → active → finished`, plus `paused` and `dropped`. Every change
  is logged with its date. Each track has an ordered queue (queued and paused books) that
  you reorder by dragging. When a book is finished, the next one in its queue is offered.
- **Sessions** record the pages read on a day, with optional minutes and a key idea. You
  can log by the page reached or by pages read. A book's `read` is `base` plus all of its
  sessions, so editing or deleting a session recalculates it. `base` holds progress no
  session accounts for: reading from before sessions existed, corrections, skims.
- **Phases** group books across tracks into blocks of the plan. A phase shows its
  completion and a projected end date based on the last 14 days' pace, and is flagged
  on track, at risk or behind.
- **Views:** Today (open books, targets, quick log, streaks, stall nudges), Tracks
  (queues), Phases, Notes (searchable key ideas and quotes) and History (finished and
  dropped books, charts, year in review). A book's own page has its sessions,
  notes and quotes, and status timeline.
- A track counts toward the top bar's *done today / not done* once it has an open book
  and a target, and it is done when today's pages reach the target.
- Covers and missing authors are still looked up from Open Library (`lib/covers.ts`),
  and a cover image address can be set by hand.

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## Firebase setup (free Spark tier)

The app runs in local-only mode (localStorage) until you add your Firebase
config. To enable cross-device sync:

1. **Create a project** at https://console.firebase.google.com → Add project.
2. **Add a Web app** (`</>` icon). Copy the `firebaseConfig` values.
3. Paste them into `lib/firebaseConfig.ts` (replace the `YOUR_…` placeholders),
   or set the `NEXT_PUBLIC_FIREBASE_*` env vars (see `.env.local.example`).
   These values are public by design — safe to commit.
4. **Enable Authentication** → Sign-in method → enable **Google** (set a
   support email when prompted) and, if you want it, **Email/Password**.
5. **Create Firestore** → Build → Firestore Database → Create database →
   Start in production mode.
6. **Publish security rules**: copy `firestore.rules` into the Rules tab and
   publish. They restrict each user to their own document only.
7. **Authorized domains** (Authentication → Settings → Authorized domains):
   add `crlupu.github.io` and your Vercel domain so sign-in works there.

That's it — create an account in the app, and your data syncs anywhere you
sign in with it. Well within the Spark free tier for personal use.

## Code layout

- `app/`: one folder per page (`page.tsx` is Goals, `tasks/page.tsx` and
  so on), plus `layout.tsx`, `providers.tsx` (theme), and the global styles
  `globals.css` + `carbon.scss`.
- `components/AppShell.tsx`: mounted once in the root layout. It holds the
  tracker (`useTracker`), the top bar and menu, the sign-in gate, and the
  New goal / New recurring task dialogs, so they carry over when you change
  page. Pages get what they need from `useShell()` / `usePageTracker()`, and
  each one wraps its content in `SectionPage` (`components/Section.tsx`).
- `components/`: one file per feature, plus shared UI: `ui.tsx` (wrappers
  around Carbon inputs, buttons and cards), `Modal`, `DeleteButton`, and
  `ActionButton` (`usePending`, for buttons that wait on a save). Icons come from `components/icons.ts`, which re-exports
  react-icons under friendly names.
- `lib/tracker.ts`: the whole data model. It holds the types, `migrate()` for
  older saved states, pure helpers (progress, streaks, per-date totals), and
  the `useTracker()` hook, which returns the state plus every action.
- `lib/firebase.ts`, `lib/firebaseConfig.ts`: Firebase setup.
- `lib/color.ts`: contrast and readable-text helpers.
- `scripts/palette-audit.py`: checks the rendered DOM against the colour
  palette and regenerates the Carbon `--cds-*` token overrides.
- `public/sw.js`: service worker. Pages, and the payloads the router fetches
  when you change page, try the network first and are cached per address;
  hashed assets are served from the cache first.

## Data model

One Firestore document per user at `users/{uid}` holding the whole
`TrackerState` as JSON (`{ state, updated }`). localStorage (key
`momentum:v1`) is an offline cache for instant first paint, never the source
of truth.

- Every change goes through `commit(fn)` in `useTracker`, which applies a pure
  `state => state` function, then caches and writes the whole document.
- New fields must be optional or given defaults in `migrate()`, because old
  documents are loaded through it. Colours from earlier themes are remapped
  there via `LEGACY_CATEGORY_COLORS`.
- `firestore.rules` restricts each user to their own document.

## Conventions

- Colours come only from the palette (`CAT_COLORS`, the Carbon values).
  `BOOK_COLORS` is the subset that white text is legible on.
- Dates are local `YYYY-MM-DD` keys (`dateKey()`), and weeks start on Monday.
- Comments explain *why* something is done, in plain prose. Keep that style
  when editing.
- There is no test suite or linter. Check changes with `npx tsc --noEmit` and
  `npm run build`.

## Deployment
- **GitHub Pages**: automatic on push to `main` via
  `.github/workflows/deploy-pages.yml` (builds with `GITHUB_PAGES=true`, which
  sets the `/momentum` base path).
- **Vercel**: import the repo (normal build, no base path).
