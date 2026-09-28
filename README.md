# Momentum — Progress Tracker

A personal progress system in one page: goals, daily and recurring tasks,
fitness, nutrition, reading and progress charts. Follows the device's light or
dark appearance, with a setting to pin either one. Data syncs across devices via Firebase (Firestore + Google or
email/password sign-in), and falls back to local-only mode until Firebase is
configured. Works offline as an installable PWA.

Stack: Next.js 15 (static export) · React 19 · Carbon (`@carbon/react`, Sass) ·
Tailwind CSS 4 · next-themes · Firebase v12 · dnd-kit · react-icons.

## Sections

Each section has its own page. On a desktop (1056px and wider) a sidebar lists
them all. On phones and tablets a tab bar holds Today, Goals, Fitness,
Nutrition and Books, and the More button beside each page title opens
Progress, Log, Settings and the appearance setting. Today is the home page.
`components/sections.ts` is the single source of truth for each section's id,
title and path.

| Section | Path | What it holds | Main components |
| --- | --- | --- | --- |
| Today | `/` | The day's momentum ring and figures, recurring tasks (daily / weekly / biweekly / monthly) and to-dos. `/tasks` forwards here | `MomentumCard`, `RecurringList`, `TodoList` |
| Goals | `/goals` | Goals with subtasks, grouped into paths | `GoalsView`, `PathsView` |
| Fitness | `/fitness` | Workouts built from blocks of exercises, a live workout player (timed circuits included), weight and cardio logs | `WorkoutsView`, `CircuitPlayer`, `WeightTracker`, `WorkoutVolumeChart` |
| Nutrition | `/nutrition` | Calories with meal tags and a weekly budget, protein and fibre against targets | `CaloriesTracker`, `MacroTracker` |
| Books | `/books` | Reading tracks: queues, phases, daily logging, notes, pace and history | `Books`, `components/books/*` |
| Progress | `/progress` | Completion charts and a month calendar | `Charts` |
| Log | `/log` | History of completed tasks, workout sessions and cardio | `CompletionLog` |
| Settings | `/configuration` | Categories, groups, recurring tasks, workouts, meal tags, calorie budget, macro targets | `Forms`, `ConfigCard` |

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
- A track counts toward Today's momentum ring once it has an open book and a target,
  and it is done when today's pages reach the target.
- **Import plan** reads a reading plan written in Markdown (`lib/planImport.ts`): a table of
  tracks, `## Phase … (Q4 2026)` headings with a `**Track**` line above each numbered list,
  a `## Slow lane (continuous)` list and a `## Dropped` list. Importing again updates what's
  there instead of duplicating it. `docs/reading-plan-2026-2028.md` is an example.
- Covers, missing authors and missing page counts are looked up from Open Library (`lib/covers.ts`),
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

- `app/`: one folder per page (`page.tsx` is Today, `goals/page.tsx` and
  so on), plus `layout.tsx`, `providers.tsx` (theme), and the global styles
  `globals.css` + `carbon.scss`.
- `components/AppShell.tsx`: mounted once in the root layout. It holds the
  tracker (`useTracker`), the navigation (`Sidebar.tsx`: sidebar, tab bar and
  More sheet), the sign-in gate, and the
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
  documents are loaded through it. Colours saved under earlier palettes
  (categories, meal tags, tracks, books) are moved onto the current one by
  `currentColor()`.
- `firestore.rules` restricts each user to their own document.

## Conventions

- Colour has two layers, both in `globals.css`:
  - **Interface:** ink on paper (`--foreground`, `--muted`, `--surface`,
    `--background`) with one accent, electric blue `#097CFB` (`--accent`).
    It is the same in light and dark and only ever means progress:
    checkmarks, rings, progress bars, the primary button, the current tab.
    It is used for shapes, fills and icons, never for text, because no
    single colour can be readable text on both a white and a dark card.
    `--accent-text` is plain ink, and text on the accent is white (4.0:1:
    fine for icons and large bold text, below AA for small labels). Amber
    (`--warning`) means behind or over; red (`--danger`) means destructive.
    Sections have no colours of their own.
  - **Data:** people's own colours (categories, meal tags, tracks, books) come
    from `CAT_COLORS` / `--data-*`: eleven hues at one luminance, each 5.0:1
    with white text and 3.4:1 on the dark card. There's no blue or cyan,
    so nothing can be mistaken for the accent. Charts use `--chart-1`
    (electric blue) and `--chart-2` (teal).
- Dates are local `YYYY-MM-DD` keys (`dateKey()`), and weeks start on Monday.
  They are shown with `lib/dates.ts` ("28 Sep", with the year only when it isn't this one,
  and times on a 24-hour clock), so every page writes them the same way.
- Type is the system face (SF Pro on Apple devices). Figures use `.font-mono-n`,
  which is the rounded variant with tabular digits. Nothing is smaller than 11px,
  and secondary text uses `--muted` (at least 4.5:1), never an opacity of the
  foreground colour.
- Controls are at least 44px tall on touch screens. Hover styles sit behind
  `@media (hover: hover)`, so a tap doesn't leave them stuck on.
- Every card is introduced by `PanelHeader` (`components/ui.tsx`). Charts are drawn at their
  measured width (`components/useWidth.ts`) and a fixed height, so their text stays the same
  size on a phone and a desktop.
- Comments explain *why* something is done, in plain prose. Keep that style
  when editing.
- There is no test suite or linter. Check changes with `npx tsc --noEmit` and
  `npm run build`.

## Deployment
- **GitHub Pages**: automatic on push to `main` via
  `.github/workflows/deploy-pages.yml` (builds with `GITHUB_PAGES=true`, which
  sets the `/momentum` base path).
- **Vercel**: import the repo (normal build, no base path).
