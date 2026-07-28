"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { useTracker } from "@/lib/tracker";
import { AuthGate } from "@/components/AuthGate";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";
import {
  GoalForm,
  RecurringForm,
  CategoriesCard,
  GroupsCard,
  RecurringManageCard,
  CalorieBudgetCard,
  MacroTargetsCard,
} from "@/components/Forms";
import GoalsView from "@/components/GoalsView";
import RecurringList from "@/components/RecurringList";
import TodoList from "@/components/TodoList";
import WeightTracker from "@/components/WeightTracker";
import CaloriesTracker from "@/components/CaloriesTracker";
import MacroTracker from "@/components/MacroTracker";
import Charts from "@/components/Charts";
import CompletionLog from "@/components/CompletionLog";

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

      <main>
        <AuthGate tracker={tracker}>
          {!tracker.state ? (
            <p className="p-6 text-foreground/60">Loading…</p>
          ) : (
            <div className="mx-auto max-w-6xl space-y-8 px-2 py-5 sm:px-4 lg:px-6">
              {tracker.syncError && (
                <div
                  role="alert"
                  className="rounded-2xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)",
                    background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                    color: "var(--danger)",
                  }}
                >
                  {tracker.syncError} Your data is still saved on this device.
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-8">
                <section id="goals" className="scroll-mt-6 lg:col-span-2">
                  <GoalsView tracker={tracker} onAdd={() => setGoalOpen(true)} />
                </section>

                <section
                  id="recurring"
                  className="side-panel scroll-mt-6 space-y-5 lg:col-span-1"
                >
                  <RecurringList tracker={tracker} onAdd={() => setRecurringOpen(true)} />
                  <TodoList tracker={tracker} />
                  <WeightTracker tracker={tracker} />
                  <CaloriesTracker tracker={tracker} />
                  <MacroTracker tracker={tracker} />
                </section>
              </div>

              <section id="charts" className="scroll-mt-6">
                <h2 className="font-display mb-4 flex items-center gap-2.5 text-2xl font-bold tracking-tight">
                  <span className="sec-dot" style={{ background: "var(--grad-teal)" }} aria-hidden />
                  Progress
                </h2>
                <Charts tracker={tracker} />
              </section>

              <section id="log" className="scroll-mt-6">
                <CompletionLog tracker={tracker} />
              </section>

              <section id="config">
                <h2 className="font-display mb-4 flex items-center gap-2.5 text-xl font-bold tracking-tight">
                  <span className="sec-dot" style={{ background: "var(--grad-magenta)" }} aria-hidden />
                  Configuration
                </h2>
                {/* Two explicit columns: each card sits straight under the one
                    above it, without CSS multi-column (which breaks scrollable
                    lists in Safari). */}
                <div className="grid items-start gap-5 md:grid-cols-2">
                  <div className="flex flex-col gap-5">
                    <div>
                      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
                        Categories
                      </h3>
                      <Card>
                        <Card.Content className="p-4 sm:p-5">
                          <CategoriesCard tracker={tracker} />
                        </Card.Content>
                      </Card>
                    </div>
                    <div>
                      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
                        Groups
                      </h3>
                      <Card>
                        <Card.Content className="p-4 sm:p-5">
                          <GroupsCard tracker={tracker} />
                        </Card.Content>
                      </Card>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div>
                      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
                        Manage recurring
                      </h3>
                      <Card>
                        <Card.Content className="p-4 sm:p-5">
                          <RecurringManageCard tracker={tracker} />
                        </Card.Content>
                      </Card>
                    </div>
                    <div>
                      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
                        Calorie budget
                      </h3>
                      <Card>
                        <Card.Content className="p-4 sm:p-5">
                          <CalorieBudgetCard tracker={tracker} />
                        </Card.Content>
                      </Card>
                    </div>
                    <div>
                      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-foreground/50">
                        Protein &amp; fibre targets
                      </h3>
                      <Card>
                        <Card.Content className="p-4 sm:p-5">
                          <MacroTargetsCard tracker={tracker} />
                        </Card.Content>
                      </Card>
                    </div>
                  </div>
                </div>
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
