# Momentum — Progress Tracker

A personal progress system in one page: goals, daily and recurring tasks,
fitness, nutrition, reading and progress charts. Light theme by default with a
dark-mode switch. Data syncs across devices via Firebase (Firestore + Google or
email/password sign-in), and falls back to local-only mode until Firebase is
configured. Works offline as an installable PWA.

Stack: Next.js 15 (static export) · React 19 · Carbon (`@carbon/react`, Sass) ·
Tailwind CSS 4 · next-themes · Firebase v12 · dnd-kit · react-icons.

## Sections

The page is one long scroll of sections, in the order defined in
`components/sections.ts` (the single source of truth for ids, titles and the
numbered index). On narrow screens each section collapses behind its heading.

| Section | What it holds | Main components |
| --- | --- | --- |
| Goals | Goals with subtasks, grouped into paths | `GoalsView`, `PathsView` |
| Tasks | Daily todos and recurring tasks (daily / weekly / biweekly / monthly) | `TodoList`, `RecurringList` |
| Fitness | Workouts built from blocks of exercises, a live workout player (timed circuits included), weight and cardio logs | `WorkoutsView`, `CircuitPlayer`, `WeightTracker`, `WorkoutVolumeChart` |
| Nutrition | Calories with meal tags and a weekly budget, protein and fibre against targets | `CaloriesTracker`, `MacroTracker` |
| Books | A shelf of books with covers and progress; set the current page from the card | `Books` |
| Progress | Completion charts and a month calendar | `Charts` |
| Log | History of completed tasks, workout sessions and cardio | `CompletionLog` |
| Configuration | Categories, groups, recurring tasks, workouts, meal tags, calorie budget, macro targets | `Forms`, `ConfigCard` |

### Books
- Book covers and missing authors are looked up from Open Library
  (`lib/covers.ts`) one book at a time, and only once per book. A lookup that
  finds nothing stores `coverId: null`. When there is no cover, one is drawn
  from the book's colour and initials.
- Typing a title while adding a book suggests matches from your own shelf
  straight away, and Open Library results after a debounce (700 ms, 6 s
  timeout).
- Progress is stored as `read` (the current page) against `pages` (the
  length). The **Page** button on a card sets the current page directly
  (`tracker.setBookProgress`). The value is clamped to the book's length, and
  `doneDate` is set when the book reaches the end and cleared if it moves back.
- The shelf is ordered in piles: in progress, then unstarted, then finished,
  each sorted alphabetically.

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

- `app/`: `page.tsx` lays out every section; `layout.tsx`, `providers.tsx`
  (theme), and the global styles `globals.css` + `carbon.scss`.
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
- `public/sw.js`: service worker. Page navigations try the network first;
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
