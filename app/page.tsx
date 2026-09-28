"use client";

import { useShell } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { MomentumCard } from "@/components/MomentumCard";
import RecurringList from "@/components/RecurringList";
import TodoList from "@/components/TodoList";

/** Today: the day's momentum, its routines and its to-dos. The home page. */
export default function TodayPage() {
  const { tracker, openRecurring } = useShell();
  const subtitle = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <SectionPage id="tasks" subtitle={subtitle}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:col-span-2">
          <MomentumCard tracker={tracker} />
        </div>
        <RecurringList tracker={tracker} onAdd={openRecurring} />
        <TodoList tracker={tracker} />
      </div>
    </SectionPage>
  );
}
