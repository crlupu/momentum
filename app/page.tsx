"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { useTracker } from "@/lib/tracker";
import { AuthGate } from "@/components/AuthGate";
import { Sidebar } from "@/components/Sidebar";
import { Section, useIsDesktop } from "@/components/Section";
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
import WorkoutVolumeChart from "@/components/WorkoutVolumeChart";
import WorkoutsView from "@/components/WorkoutsView";
import Charts from "@/components/Charts";
import CompletionLog from "@/components/CompletionLog";

export default function Home() {
  const tracker = useTracker();
  const [goalOpen, setGoalOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const isDesktop = useIsDesktop();
  // Which sections the reader has opened. Only consulted on narrow screens.
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const isOpen = (id: string) => opened.has(id);
  const toggle = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Jumping to a section from the menu opens it first, or the anchor would
  // land on a collapsed heading.
  const reveal = (id: string) => setOpened((prev) => new Set(prev).add(id));

  return (
    <div className="min-h-screen">
      <Sidebar
        tracker={tracker}
        onAddGoal={() => setGoalOpen(true)}
        onAddRecurring={() => setRecurringOpen(true)}
        onNavigate={reveal}
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
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
              <Section
                id="goals"
                title="Goals"
                gradient="var(--grad-primary)"
                open={isOpen("goals")}
                onToggle={() => toggle("goals")}
                isDesktop={isDesktop}
                className="md:col-span-2"
              >
                <GoalsView tracker={tracker} onAdd={() => setGoalOpen(true)} />
              </Section>

              <Section
                id="tasks"
                title="Tasks"
                gradient="var(--grad-teal)"
                open={isOpen("tasks")}
                onToggle={() => toggle("tasks")}
                isDesktop={isDesktop}
                className="md:col-span-1"
              >
                {/* a third of the row, so these stack rather than sit side by side */}
                <div className="space-y-5">
                  <TodoList tracker={tracker} />
                  <RecurringList tracker={tracker} onAdd={() => setRecurringOpen(true)} />
                </div>
              </Section>
              </div>

              <Section
                id="fitness"
                title="Fitness"
                gradient="var(--grad-magenta)"
                open={isOpen("fitness")}
                onToggle={() => toggle("fitness")}
                isDesktop={isDesktop}
              >
                <div className="grid items-start gap-5 lg:grid-cols-2">
                  <WeightTracker tracker={tracker} />
                  <div>
                    <h3 className="font-display mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
                      <span className="sec-dot" style={{ background: "var(--grad-primary)" }} aria-hidden />
                      Workouts
                    </h3>
                    <Card>
                      <Card.Content className="p-4 sm:p-5">
                        <WorkoutsView tracker={tracker} />
                      </Card.Content>
                    </Card>
                  </div>
                </div>
              </Section>

              <Section
                id="nutrition"
                title="Nutrition"
                gradient="var(--grad-success)"
                open={isOpen("nutrition")}
                onToggle={() => toggle("nutrition")}
                isDesktop={isDesktop}
              >
                <div className="grid items-start gap-5 lg:grid-cols-2">
                  <CaloriesTracker tracker={tracker} />
                  <MacroTracker tracker={tracker} />
                </div>
              </Section>

              <Section
                id="charts"
                title="Progress"
                gradient="var(--grad-teal)"
                open={isOpen("charts")}
                onToggle={() => toggle("charts")}
                isDesktop={isDesktop}
              >
                <Charts tracker={tracker} />
                <div className="mt-6">
                  <WorkoutVolumeChart tracker={tracker} />
                </div>
              </Section>

              <Section
                id="log"
                title="Log"
                gradient="var(--grad-teal)"
                open={isOpen("log")}
                onToggle={() => toggle("log")}
                isDesktop={isDesktop}
              >
                <CompletionLog tracker={tracker} />
              </Section>

              <Section
                id="config"
                title="Configuration"
                gradient="var(--grad-magenta)"
                size="md"
                open={isOpen("config")}
                onToggle={() => toggle("config")}
                isDesktop={isDesktop}
              >
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
              </Section>
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
