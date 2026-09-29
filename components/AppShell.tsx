"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Tracker, useTracker } from "@/lib/tracker";
import { AuthGate } from "./AuthGate";
import { MoreSheet, Sidebar, TabBar } from "./Sidebar";
import { Modal } from "./Modal";
import { GoalForm, RecurringForm } from "./Forms";

type Shell = {
  tracker: Tracker;
  openGoal: () => void;
  openRecurring: () => void;
  /** The phone's More sheet: Progress, Log, Settings, appearance. */
  openMore: () => void;
};

const ShellContext = createContext<Shell | null>(null);

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
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Behind the sign-in screen there is nothing to navigate to yet.
  const gated = tracker.firebaseConfigured && !tracker.user;

  const shell: Shell = {
    tracker,
    openGoal: () => setGoalOpen(true),
    openRecurring: () => setRecurringOpen(true),
    openMore: () => setMoreOpen(true),
  };

  return (
    <ShellContext.Provider value={shell}>
      <div className={"app-frame min-h-screen" + (gated ? " is-gated" : "")}>
        {!gated && <Sidebar tracker={tracker} />}

        <main className="app-main">
          <AuthGate tracker={tracker}>
            {!tracker.state ? (
              <p className="p-6 text-[var(--muted)]">Loading…</p>
            ) : (
              <div className="app-content">
                {tracker.syncError && (
                  <div role="alert" className="sync-alert">
                    {tracker.syncError} Your data is still saved on this device.
                  </div>
                )}
                {children}
              </div>
            )}
          </AuthGate>
        </main>

        {!gated && <TabBar />}
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} tracker={tracker} />

        <Modal open={goalOpen} onClose={() => setGoalOpen(false)} title="New goal">
          <GoalForm tracker={tracker} onDone={() => setGoalOpen(false)} />
        </Modal>
        <Modal
          open={recurringOpen}
          onClose={() => setRecurringOpen(false)}
          title="New recurring task"
        >
          <RecurringForm tracker={tracker} onDone={() => setRecurringOpen(false)} />
        </Modal>
      </div>
    </ShellContext.Provider>
  );
}
