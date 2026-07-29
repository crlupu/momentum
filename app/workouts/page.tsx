"use client";

import { useState } from "react";
import { useTracker } from "@/lib/tracker";
import { AuthGate } from "@/components/AuthGate";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { GoalForm, RecurringForm } from "@/components/Forms";
import WorkoutsView from "@/components/WorkoutsView";

export default function WorkoutsPage() {
  const tracker = useTracker();
  const [goalOpen, setGoalOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  return (
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
            <div className="mx-auto max-w-6xl space-y-8 px-2 py-5 sm:px-4 lg:px-6">
              <WorkoutsView tracker={tracker} />
            </div>
          )}
        </AuthGate>
      </main>

      {/* the sidebar's quick-add actions work from this page too */}
      <Modal open={goalOpen} onClose={() => setGoalOpen(false)} title="New goal">
        <GoalForm tracker={tracker} onDone={() => setGoalOpen(false)} />
      </Modal>
      <Modal open={recurringOpen} onClose={() => setRecurringOpen(false)} title="New recurring task">
        <RecurringForm tracker={tracker} onDone={() => setRecurringOpen(false)} />
      </Modal>
    </div>
  );
}
