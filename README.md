# Momentum — Progress Tracker

Personal progress system: daily categorized todos, a Planned / In progress / Done
board, and progress charts (14-day bars, contribution heatmap, monthly stats).

Light theme by default with a light/dark switch.

Stack: Next.js 15 (App Router, static export) · React 19 · HeroUI v3 (React Aria +
Tailwind CSS v4) · next-themes · lucide-react.

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## Production
```bash
npm run build      # static export to ./out
```

## Deployment
- **GitHub Pages**: pushed automatically via `.github/workflows/deploy-pages.yml`
  (builds with `GITHUB_PAGES=true` so assets use the `/momentum` base path).
- **Vercel**: import the repo; the normal build (no base path) is used there.

## Structure
- `lib/tracker.ts` — state model, localStorage persistence, derived stats
- `app/providers.tsx` — next-themes provider (defaults to light)
- `components/ThemeSwitch.tsx` — HeroUI Switch bound to the theme
- `components/TodayView.tsx` / `BoardView.tsx` / `ProgressView.tsx` — the three tabs
- `components/CatChip.tsx` — category chip helper

## Data
State is saved to `localStorage` (`momentum:v1`), per browser. To sync across
devices, replace the two `localStorage` calls in `lib/tracker.ts` with Firestore
reads/writes.
