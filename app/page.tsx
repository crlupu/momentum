"use client";

import Link from "next/link";
import { useShell } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { MomentumCard } from "@/components/MomentumCard";
import RecurringList from "@/components/RecurringList";
import TodoList from "@/components/TodoList";
import { PlanCard, PlanWelcome } from "@/components/plan/PlanCard";
import { PlanLeftovers, PlanTimeline } from "@/components/plan/PlanTimeline";
import { PlanGlyph } from "@/components/plan/bits";
import { addDays, planOf, plannedKeys, stepsOn, WEEKDAY_LONG, weekdayOf, type DayPlan } from "@/lib/plan";
import { dateKey } from "@/lib/tracker";
import { routines } from "@/lib/routines";

/**
 * Today: with a day plan, its card, the day's steps as a timeline, what else
 * repeats this week and the to-dos. Without one, the day's routines as
 * before, with an invitation to make a plan.
 */
export default function TodayPage() {
  const { tracker } = useShell();
  const subtitle = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const plan = tracker.state ? planOf(tracker.state) : null;
  const planned = plan && plan.steps.length > 0 ? plan : null;
  const restDay = planned && stepsOn(tracker.state!, planned, dateKey()).length === 0;
  // Day one: no plan and nothing repeating yet, so the card invites a plan.
  const fresh = !planned && !!tracker.state && routines(tracker.state).length === 0;

  return (
    <SectionPage id="tasks" subtitle={subtitle}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="md:col-span-2">
          {planned ? <PlanCard tracker={tracker} plan={planned} /> : fresh ? <PlanWelcome /> : <MomentumCard tracker={tracker} />}
        </div>
        {planned ? (
          <>
            <div className="flex flex-col gap-6">
              <PlanTimeline tracker={tracker} plan={planned} />
              {restDay && <NextPlanDay plan={planned} />}
            </div>
            <div className="flex flex-col gap-6">
              <div className="today-leftovers">
                <PlanLeftovers tracker={tracker} plan={planned} />
              </div>
              <RecurringList tracker={tracker} exclude={plannedKeys(planned, tracker.state!)} title="Also this week" />
              <TodoList tracker={tracker} />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-6">
              <RecurringList tracker={tracker} />
            </div>
            <TodoList tracker={tracker} />
          </>
        )}
      </div>
    </SectionPage>
  );
}

/** On a day off: the next plan day's steps, so the week ahead is in view. */
function NextPlanDay({ plan }: { plan: DayPlan }) {
  const today = dateKey();
  let day = addDays(today, 1);
  for (let i = 0; i < 7 && !plan.days.includes(weekdayOf(day)); i++) day = addDays(day, 1);
  return (
    <section>
      <div className="panel-head">
        <h2 className="panel-head__title">{WEEKDAY_LONG[weekdayOf(day)]}&rsquo;s plan</h2>
        <div className="panel-head__side">
          <Link href="/plan" className="text-action">
            Edit plan
          </Link>
        </div>
      </div>
      <div className="card plan-ahead">
        <ul className="plan-ahead__chips">
          {plan.steps.map((st) => (
            <li key={st.id} className="plan-chip">
              <PlanGlyph icon={st.icon} />
              {st.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
