"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that lets the app open without a network.
 *
 * The scope is the app's own base path, which differs between GitHub Pages
 * (/momentum/) and a root deployment, and is read from where this script was
 * served rather than guessed — a worker registered at the wrong scope silently
 * controls nothing.
 */
export function ServiceWorker({ base }: { base: string }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Registered after load rather than during it: the worker is for the next
    // visit, and competing with the page's own requests helps nobody.
    /** Everything this page actually loaded from our own origin. */
    const assets = () =>
      performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin) && /\.(js|css|woff2?|png|svg|ico|json)$/.test(u));

    const warm = () => {
      const sw = navigator.serviceWorker.controller;
      if (sw) sw.postMessage({ type: "cache", urls: assets() });
    };

    const register = () => {
      navigator.serviceWorker
        .register(`${base}/sw.js`, { scope: `${base}/` })
        .then(() => {
          // On the very first visit nothing is controlling the page until the
          // worker claims it, so the list is sent on both events — whichever
          // comes first, and the second send is a no-op.
          warm();
          navigator.serviceWorker.addEventListener("controllerchange", warm);
        })
        .catch(() => {
          // A refused registration is not worth interrupting anyone over. The
          // app works exactly as it did before, just without the offline copy.
        });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, [base]);

  return null;
}
