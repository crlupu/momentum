"use client";

import Link from "next/link";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import RecurringList from "@/components/RecurringList";
import { PlanLeftovers, PlanTimeline } from "@/components/plan/PlanTimeline";
import { PlanGlyph } from "@/components/plan/bits";
import { ChevronLeft } from "@/components/icons";
import { addDays, planOf, stepsOn, WEEKDAY_LONG, weekdayOf, type DayPlan } from "@/lib/plan";
import { dateKey } from "@/lib/tracker";

/**
 * The routine, opened from Today's card: today's habits as rows (each opens
 * into its panel), what earlier plan days left, and on a day off the next
 * plan day. Without a day plan, the day's routines.
 */
export default function RoutinePage() {
  const tracker = usePageTracker();
  const s = tracker.state;
  const plan = s ? planOf(s) : null;
  const planned = plan && plan.steps.length > 0 ? plan : null;
  const restDay = planned && stepsOn(s!, planned, dateKey()).length === 0;
  return (
    <SectionPage
      id="tasks"
      tone="habit"
      title="Routine"
      subtitle={
        <Link href="/" className="back-link">
          <ChevronLeft aria-hidden />
          Today
        </Link>
      }
    >
      {s && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {planned ? (
            <>
              <div className="flex flex-col gap-6">
                <PlanTimeline tracker={tracker} plan={planned} />
                {restDay && <NextPlanDay plan={planned} />}
              </div>
              <div className="today-leftovers">
                <PlanLeftovers tracker={tracker} plan={planned} />
              </div>
            </>
          ) : (
            <RecurringList tracker={tracker} />
          )}
        </div>
      )}
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
