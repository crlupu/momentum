// Firebase web config.
//
// These values are NOT secret — the Firebase web config is meant to ship in
// client code. Access to your data is controlled by Firestore security rules,
// not by hiding these keys. So it is safe to paste them here and commit them.
//
// Where to find them: Firebase Console → Project settings (gear icon) →
// "Your apps" → Web app → SDK setup and configuration → Config.
//
// You can either paste them below, or provide them as NEXT_PUBLIC_FIREBASE_*
// environment variables (env vars win when present).

const fromEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 👇 PASTE YOUR CONFIG HERE (replace the YOUR_… placeholders)
const hardcoded = {
  apiKey: "AIzaSyCxfHgWe-GA8mIDsXE9JYn5jt1eWRdPFIk",
  authDomain: "momentum-b9c86.firebaseapp.com",
  projectId: "momentum-b9c86",
  storageBucket: "momentum-b9c86.firebasestorage.app",
  messagingSenderId: "924083476427",
  appId: "1:924083476427:web:94eec7d88eb4b589e1884e",
};

export const firebaseConfig = {
  apiKey: fromEnv.apiKey || hardcoded.apiKey,
  authDomain: fromEnv.authDomain || hardcoded.authDomain,
  projectId: fromEnv.projectId || hardcoded.projectId,
  storageBucket: fromEnv.storageBucket || hardcoded.storageBucket,
  messagingSenderId: fromEnv.messagingSenderId || hardcoded.messagingSenderId,
  appId: fromEnv.appId || hardcoded.appId,
};

// True once real values are in place. Until then the app runs in local-only
// mode (localStorage) so it still works before Firebase is set up.
export const isFirebaseConfigured =
  !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
