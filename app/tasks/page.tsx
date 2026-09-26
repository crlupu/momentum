"use client";

import { useShell } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import RecurringList from "@/components/RecurringList";
import TodoList from "@/components/TodoList";

export default function TasksPage() {
  const { tracker, openRecurring } = useShell();
  return (
    <SectionPage id="tasks">
      <div className="grid items-start gap-5 md:grid-cols-2">
        <RecurringList tracker={tracker} onAdd={openRecurring} />
        <TodoList tracker={tracker} />
      </div>
    </SectionPage>
  );
}
