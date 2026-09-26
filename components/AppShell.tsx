"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import { Tracker, useTracker } from "@/lib/tracker";
import { AuthGate } from "./AuthGate";
import { Sidebar } from "./Sidebar";
import { Modal } from "./Modal";
import { GoalForm, RecurringForm } from "./Forms";

type Shell = {
  tracker: Tracker;
  openGoal: () => void;
  openRecurring: () => void;
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
  const [goalOpen, setGoalOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const shell: Shell = {
    tracker,
    openGoal: () => setGoalOpen(true),
    openRecurring: () => setRecurringOpen(true),
  };

  return (
    <ShellContext.Provider value={shell}>
      <div className="min-h-screen">
        <Sidebar
          tracker={tracker}
          onAddGoal={() => setGoalOpen(true)}
          onAddRecurring={() => setRecurringOpen(true)}
        />

        <main>
          <AuthGate tracker={tracker}>
            {!tracker.state ? (
              <p className="p-6 text-foreground/60">Loading…</p>
            ) : (
              <div className="mx-auto max-w-[99rem] space-y-8 px-2 py-5 md:px-4 lg:px-6">
                {tracker.syncError && (
                  <div
                    role="alert"
                    className="border px-4 py-3 text-sm"
                    style={{
                      borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)",
                      background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                      color: "var(--danger)",
                    }}
                  >
                    {tracker.syncError} Your data is still saved on this device.
                  </div>
                )}
                {children}
              </div>
            )}
          </AuthGate>
        </main>

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
