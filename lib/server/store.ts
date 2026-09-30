/**
 * The connector's access to the app's data: the one Firestore document the
 * app keeps per user (users/{uid} = { state, updated }), read and written
 * with the Admin SDK. Server only — the service account never reaches a
 * browser.
 *
 * Environment (set on Vercel):
 *   FIREBASE_SERVICE_ACCOUNT  the service account's JSON key, whole
 *   MOMENTUM_UID              whose data: the Firebase Auth user id
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { migrate, type TrackerState } from "../model";

function db() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set.");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getFirestore();
}

function ref() {
  const uid = process.env.MOMENTUM_UID;
  if (!uid) throw new Error("MOMENTUM_UID is not set.");
  return db().collection("users").doc(uid);
}

/** Strips `undefined` values — Firestore rejects them, as the app's saves do. */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export async function readState(): Promise<TrackerState> {
  const snap = await ref().get();
  const data = snap.data();
  if (!data?.state) throw new Error("No data yet: open Momentum and sign in once first.");
  return migrate(data.state);
}

/**
 * Applies a change in a transaction, so an edit made in the app at the same
 * moment is never overwritten by a stale copy. The app is subscribed to the
 * document, so the change shows there straight away.
 */
export async function change<R>(fn: (s: TrackerState) => { state: TrackerState; result: R }): Promise<R> {
  const r = ref();
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    const data = snap.data();
    if (!data?.state) throw new Error("No data yet: open Momentum and sign in once first.");
    const { state, result } = fn(migrate(data.state));
    tx.set(r, clean({ state, updated: Date.now() }));
    return result;
  });
}
