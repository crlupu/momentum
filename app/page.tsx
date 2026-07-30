"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { useTracker } from "@/lib/tracker";
import { AuthGate } from "@/components/AuthGate";
import { Sidebar } from "@/components/Sidebar";
import { Section, SectionBand, useIsDesktop } from "@/components/Section";
import { ConfigCard } from "@/components/ConfigCard";
import { Modal } from "@/components/Modal";
import {
  GoalForm,
  RecurringForm,
  CategoriesCard,
  GroupsCard,
  RecurringManageCard,
  CalorieBudgetCard,
  MacroTargetsCard,
  MealTagsCard,
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
  // Until the media query resolves, assume the wide layout so the prerendered
  // HTML carries the full content.
  const mobile = isDesktop === false;

  /* Two explicit columns: each card sits straight under the one above it,
     without CSS multi-column (which breaks scrollable lists in Safari). */
  const configuration = (
        <div className="grid items-start gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <ConfigCard title={"Manage recurring"}>
<RecurringManageCard tracker={tracker} />
            </ConfigCard>
            <ConfigCard title={"Categories"}>
<CategoriesCard tracker={tracker} />
            </ConfigCard>
            <ConfigCard title={"Groups"}>
<GroupsCard tracker={tracker} />
            </ConfigCard>
          </div>
          <div className="flex flex-col gap-5">
            <ConfigCard title={"Workouts"}>
<WorkoutsView tracker={tracker} />
            </ConfigCard>
            <ConfigCard title={"Meal tags"}>
<MealTagsCard tracker={tracker} />
            </ConfigCard>
            <ConfigCard title={"Calorie budget"}>
<CalorieBudgetCard tracker={tracker} />
            </ConfigCard>
            <ConfigCard title={"Protein & fibre targets"}>
<MacroTargetsCard tracker={tracker} />
            </ConfigCard>
          </div>
        </div>
  );

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
              {mobile ? (
                /* Phones: one collapsible section per area. */
                <>
                  <Section
                    id="goals"
                    open={isOpen("goals")}
                    onToggle={() => toggle("goals")}
                    isDesktop={isDesktop}
                  >
                    <GoalsView tracker={tracker} onAdd={() => setGoalOpen(true)} />
                  </Section>

                  <Section
                    id="tasks"
                    open={isOpen("tasks")}
                    onToggle={() => toggle("tasks")}
                    isDesktop={isDesktop}
                  >
                    <div className="space-y-5">
                      <RecurringList tracker={tracker} onAdd={() => setRecurringOpen(true)} />
                      <TodoList tracker={tracker} />
                    </div>
                  </Section>

                  <Section
                    id="fitness"
                    open={isOpen("fitness")}
                    onToggle={() => toggle("fitness")}
                    isDesktop={isDesktop}
                  >
                    <div className="space-y-5">
                      <WeightTracker tracker={tracker} />
                      <WorkoutVolumeChart tracker={tracker} />
                    </div>
                  </Section>

                  <Section
                    id="nutrition"
                    open={isOpen("nutrition")}
                    onToggle={() => toggle("nutrition")}
                    isDesktop={isDesktop}
                  >
                    <div className="space-y-5">
                      <CaloriesTracker tracker={tracker} />
                      <MacroTracker tracker={tracker} />
                    </div>
                  </Section>

                  <Section
                    id="charts"
                    open={isOpen("charts")}
                    onToggle={() => toggle("charts")}
                    isDesktop={isDesktop}
                  >
                    <Charts tracker={tracker} />
                  </Section>

                  <Section
                    id="log"
                    open={isOpen("log")}
                    onToggle={() => toggle("log")}
                    isDesktop={isDesktop}
                  >
                    <CompletionLog tracker={tracker} />
                  </Section>

                  <Section
                    id="config"
                    size="md"
                    open={isOpen("config")}
                    onToggle={() => toggle("config")}
                    isDesktop={isDesktop}
                  >
                    {configuration}
                  </Section>
                </>
              ) : (
                /* Tablet and up: goals on the left, every daily tracker stacked
                   in one continuous column on the right. */
                <>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <section id="goals" className="section-panel scroll-mt-6 md:col-span-2">
                      <SectionBand id="goals" />
                      <div className="section-panel__body">
                        <GoalsView tracker={tracker} onAdd={() => setGoalOpen(true)} />
                      </div>
                    </section>

                    <div className="side-column space-y-5 md:col-span-1">
                      <section id="tasks" className="scroll-mt-6 space-y-5">
                        <RecurringList tracker={tracker} onAdd={() => setRecurringOpen(true)} />
                        <TodoList tracker={tracker} />
                      </section>
                      <section id="weight" className="scroll-mt-6">
                        <WeightTracker tracker={tracker} />
                      </section>
                      <section id="nutrition" className="scroll-mt-6 space-y-5">
                        <CaloriesTracker tracker={tracker} />
                        <MacroTracker tracker={tracker} />
                      </section>
                    </div>
                  </div>

                  <section id="fitness" className="section-panel scroll-mt-6">
                    <SectionBand id="fitness" />
                    <div className="section-panel__body">
                      <WorkoutVolumeChart tracker={tracker} />
                    </div>
                  </section>

                  <section id="charts" className="section-panel scroll-mt-6">
                    <SectionBand id="charts" />
                    <div className="section-panel__body">
                      <Charts tracker={tracker} />
                    </div>
                  </section>

                  <section id="log" className="section-panel scroll-mt-6">
                    <SectionBand id="log" />
                    <div className="section-panel__body">
                      <CompletionLog tracker={tracker} />
                    </div>
                  </section>

                  <section id="config" className="section-panel scroll-mt-6">
                    <SectionBand id="config" size="md" />
                    <div className="section-panel__body">
                      {configuration}
                    </div>
                  </section>
                </>
              )}
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
