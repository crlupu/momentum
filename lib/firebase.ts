"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "./firebaseConfig";

export { isFirebaseConfigured };

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

/**
 * Initializes Firebase once, in the browser only. Returns null when Firebase
 * isn't configured yet or when called during server rendering.
 */
export function getFirebase() {
  if (typeof window === "undefined" || !isFirebaseConfigured) return null;
  if (cached) return cached;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}
