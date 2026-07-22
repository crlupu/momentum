# Momentum — Progress Tracker

Personal progress system: daily categorized todos, a Planned / In progress / Done
board, and progress charts. Light theme by default with a dark-mode switch.
Data syncs across devices via Firebase (Firestore + email/password auth), and
falls back to local-only mode until Firebase is configured.

Stack: Next.js 15 (static export) · React 19 · HeroUI v3 · next-themes ·
Firebase v12 · lucide-react.

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
4. **Enable Authentication** → Sign-in method → **Email/Password** → Enable.
5. **Create Firestore** → Build → Firestore Database → Create database →
   Start in production mode.
6. **Publish security rules**: copy `firestore.rules` into the Rules tab and
   publish. They restrict each user to their own document only.
7. **Authorized domains** (Authentication → Settings → Authorized domains):
   add `crlupu.github.io` and your Vercel domain so sign-in works there.

That's it — create an account in the app, and your data syncs anywhere you
sign in with it. Well within the Spark free tier for personal use.

## Data model
One Firestore document per user at `users/{uid}` holding the whole state as
JSON. localStorage is kept as an offline cache and for instant first paint.

## Deployment
- **GitHub Pages**: automatic via `.github/workflows/deploy-pages.yml`.
- **Vercel**: import the repo (normal build, no base path).
