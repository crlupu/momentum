"use client";

import { createContext, ReactNode, Suspense, useContext, useEffect, useMemo, useState } from "react";
import { Tracker, useTracker } from "@/lib/tracker";
import { AuthGate } from "./AuthGate";
import { MoreSheet, Sidebar, TabBar } from "./Sidebar";
import { Modal } from "./Modal";
import { GoalForm } from "./Forms";
import { TabPanes, isPane } from "./TabPanes";
import { QuickAdd, type Toast } from "./QuickAdd";
import { ReadingFlow } from "./books/flow";
import { FocusScreen } from "./FocusScreen";
import { Check } from "./icons";
import { usePathname, useRouter } from "next/navigation";
import { NAV, navPath, sectionPath, trimPath } from "./sections";

type Shell = {
  tracker: Tracker;
  openGoal: () => void;
  /** The phone's More sheet: Progress, Log, Settings, appearance. */
  openMore: () => void;
  /** Brings a tucked-away focus block back to full screen. */
  openFocus: () => void;
};

export const ShellContext = createContext<Shell | null>(null);

/**
 * What every page shares, and what the pages are handed.
 *
 * Lives in the root layout rather than in each page, so moving between pages
 * keeps the tracker — its state, the sign-in and the Firestore listener —
 * instead of starting each one over from the cached copy.
 */
export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell is only available inside AppShell");
  return shell;
}

/**
 * The tracker, for a page. Only pages rendered once the state has loaded use
 * this, so `tracker.state` is always there when they read it.
 */
export function usePageTracker(): Tracker {
  return useShell().tracker;
}

export function AppShell({ children }: { children: ReactNode }) {
  const tracker = useTracker();

  // The first number formatted in a session loads the locale's rules, which
  // took ~30 ms on a phone — spent on whichever tap first showed a count.
  // Done here instead, once the page is idle.
  useEffect(() => {
    const warm = () => void (1234.5).toLocaleString();
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(warm);
    else setTimeout(warm, 500);
  }, []);
  const [goalOpen, setGoalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // What the + just logged, with Undo for a few seconds.
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);
  const showToast = (t: Toast) => setToast(t);
  // A running focus block takes the whole screen. Tucked away, it stays so
  // until the block changes or the app is opened again.
  const focusAt = tracker.state?.activeFocus?.startedAt ?? null;
  const [tuckedAt, setTuckedAt] = useState<number | null>(null);
  useEffect(() => {
    const back = () => document.visibilityState === "visible" && setTuckedAt(null);
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);
  // Behind the sign-in screen there is nothing to navigate to yet.
  const gated = tracker.firebaseConfigured && !tracker.user && !tracker.opening;
  const path = trimPath(usePathname() ?? "/");
  const pane = isPane(path) ? path : null;

  // Keyboard, for a desk: N adds, 1–4 open the areas, / searches Settings.
  // Never while typing, with a modifier held, or over an open sheet.
  const router = useRouter();
  useEffect(() => {
    if (gated) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        setAddOpen(true);
      } else if (/^[1-4]$/.test(k)) {
        e.preventDefault();
        router.push(navPath(NAV[Number(k) - 1].id));
      } else if (k === "/") {
        e.preventDefault();
        const config = sectionPath("config");
        if (path !== trimPath(config)) router.push(config);
        // The page may still be on its way: look for the field for a moment.
        let tries = 0;
        const find = () => {
          const field = document.querySelector<HTMLInputElement>(".tab-pane:not([hidden]) .settings-search input, .settings-search input");
          if (field) field.focus();
          else if (tries++ < 60) requestAnimationFrame(find);
        };
        find();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gated, router, path]);

  // Kept the same object until the tracker changes, so moving between
  // pages doesn't re-render every page that reads it.
  const shell = useMemo<Shell>(
    () => ({ tracker, openGoal: () => setGoalOpen(true), openMore: () => setMoreOpen(true), openFocus: () => setTuckedAt(null) }),
    [tracker]
  );

  return (
    <ShellContext.Provider value={shell}>
      <div className={"app-frame min-h-screen" + (gated ? " is-gated" : "")}>
        {!gated && <Sidebar tracker={tracker} onAdd={() => setAddOpen(true)} />}

        <main className="app-main">
          <AuthGate tracker={tracker}>
            {!tracker.state ? (
              <PageSkeleton />
            ) : (
              <div className="app-content">
                {/* The tabs' pages stay mounted; any other page is the route's own. */}
                <Suspense fallback={null}>
                  <TabPanes current={pane} />
                </Suspense>
                {!pane && children}
              </div>
            )}
          </AuthGate>
        </main>

        {!gated && <TabBar onAdd={() => setAddOpen(true)} />}
        {!gated && tracker.state && (
          <ReadingFlow tracker={tracker}>
            <QuickAdd tracker={tracker} open={addOpen} onClose={() => setAddOpen(false)} onToast={showToast} />
          </ReadingFlow>
        )}
        {toast && (
          <div className="toast" role="status">
            <span className="toast__mark" aria-hidden>
              <Check />
            </span>
            <span className="toast__text">{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                className="toast__undo"
                onClick={() => {
                  void tracker.restore(toast.undo!);
                  setToast(null);
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}
        {!gated && focusAt != null && tuckedAt !== focusAt && <FocusScreen tracker={tracker} onTuck={() => setTuckedAt(focusAt)} />}
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} tracker={tracker} />

        <Modal open={goalOpen} onClose={() => setGoalOpen(false)} title="New goal">
          <GoalForm tracker={tracker} onDone={() => setGoalOpen(false)} />
        </Modal>
      </div>
    </ShellContext.Provider>
  );
}

/**
 * The shape of a page while the data arrives: a title, the hero card and two
 * lists, shimmering. In place of the word "Loading".
 */
function PageSkeleton() {
  return (
    <div className="app-content skeleton" role="status" aria-label="Loading">
      <span className="skeleton__line" style={{ inlineSize: "8.75rem" }} />
      <span className="skeleton__line skeleton__line--title" />
      <span className="skeleton__block" style={{ blockSize: "11.25rem", borderRadius: 20 }} />
      <span className="skeleton__line skeleton__line--label" />
      <span className="skeleton__block" style={{ blockSize: "14rem" }} />
      <span className="skeleton__line skeleton__line--label" />
      <span className="skeleton__block" style={{ blockSize: "7.5rem" }} />
    </div>
  );
}
