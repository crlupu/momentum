"use client";

import { useState } from "react";
import { Card } from "@heroui/react";
import { useTracker } from "@/lib/tracker";
import { AuthGate } from "@/components/AuthGate";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import { GoalForm, RecurringForm, CategoriesCard } from "@/components/Forms";
import GoalsView from "@/components/GoalsView";
import RecurringList from "@/components/RecurringList";
import Charts from "@/components/Charts";

export default function Home() {
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

      <main className="md:ml-60">
        <AuthGate tracker={tracker}>
          {!tracker.state ? (
            <p className="p-6 text-foreground/60">Loading…</p>
          ) : (
            <div className="mx-auto max-w-4xl space-y-10 px-4 py-6 sm:px-6">
              <section id="goals" className="scroll-mt-6">
                <GoalsView tracker={tracker} onAdd={() => setGoalOpen(true)} />
              </section>

              <section id="recurring" className="scroll-mt-6">
                <RecurringList tracker={tracker} onAdd={() => setRecurringOpen(true)} />
              </section>

              <section id="charts" className="scroll-mt-6">
                <h2 className="font-display mb-4 text-2xl font-bold tracking-tight">Progress</h2>
                <Charts tracker={tracker} />
              </section>

              <section>
                <h2 className="font-display mb-4 text-xl font-bold tracking-tight">Categories</h2>
                <Card>
                  <Card.Content className="p-4 sm:p-5">
                    <CategoriesCard tracker={tracker} />
                  </Card.Content>
                </Card>
              </section>
            </div>
          )}
        </AuthGate>
      </main>

      <Modal open={goalOpen} onClose={() => setGoalOpen(false)} title="New goal">
        <GoalForm tracker={tracker} onDone={() => setGoalOpen(false)} />
      </Modal>
      <Modal open={recurringOpen} onClose={() => setRecurringOpen(false)} title="New recurring task">
        <RecurringForm tracker={tracker} onDone={() => setRecurringOpen(false)} />
      </Modal>
    </div>
  );
}
