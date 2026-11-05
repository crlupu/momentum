"use client";

import Link from "next/link";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import TodoList from "@/components/TodoList";
import RecurringList from "@/components/RecurringList";
import { ChevronLeft } from "@/components/icons";
import { planOf, plannedKeys } from "@/lib/plan";

/**
 * To-dos, on a page of their own: the list as it was on Today, and what
 * else comes round this week (weekly tasks and routines the plan doesn't
 * already hold).
 */
export default function TodosPage() {
  const tracker = usePageTracker();
  const s = tracker.state;
  const plan = s ? planOf(s) : null;
  return (
    <SectionPage
      id="tasks"
      tone="todo"
      title="To-dos"
      subtitle={
        <Link href="/" className="back-link">
          <ChevronLeft aria-hidden />
          Today
        </Link>
      }
    >
      {s && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TodoList tracker={tracker} />
          <RecurringList tracker={tracker} exclude={plan && plan.steps.length ? plannedKeys(plan, s) : undefined} title="Also this week" />
        </div>
      )}
    </SectionPage>
  );
}
