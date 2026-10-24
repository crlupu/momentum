"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { ConfigCard } from "@/components/ConfigCard";
import {
  CategoriesCard,
  CalorieBudgetCard,
  MacroTargetsCard,
  MealTagsCard,
} from "@/components/Forms";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { validPlan } from "@/lib/weight";
import type { Tracker } from "@/lib/tracker";

/** The settings each row opens, by the `view` it sets. */
const VIEWS: Record<string, { title: string; body: (t: Tracker) => ReactNode }> = {
  categories: { title: "Categories", body: (t) => <CategoriesCard tracker={t} /> },
  meals: { title: "Meal tags", body: (t) => <MealTagsCard tracker={t} /> },
  budget: { title: "Calorie budget", body: (t) => <CalorieBudgetCard tracker={t} /> },
  macros: { title: "Protein & fibre targets", body: (t) => <MacroTargetsCard tracker={t} /> },
};

/**
 * Settings as one list: each kind of setting is a row showing its value,
 * opening a page of its own where it's edited.
 */
function Settings() {
  const tracker = usePageTracker();
  const view = useSearchParams().get("view");
  const s = tracker.state;
  const open = view ? VIEWS[view] : undefined;

  if (open) {
    return (
      <SectionPage
        id="config"
        title={open.title}
        subtitle={
          <Link href="/configuration" className="back-link">
            <ChevronLeft aria-hidden />
            Settings
          </Link>
        }
      >
        {/* The page title already names it; the card carries only its Edit. */}
        <ConfigCard title="">{open.body(tracker)}</ConfigCard>
      </SectionPage>
    );
  }

  const plan = s ? validPlan(s.weightPlan) : undefined;
  const n = (v: number | undefined) => (v ? v.toLocaleString() : "Not set");
  return (
    <SectionPage id="config">
      <div className="flex max-w-xl flex-col gap-6">
        <SettingsGroup title="Tracking">
          <SettingsRow href="/configuration?view=categories" label="Categories" value={String(s?.categories.length ?? 0)} />
          <SettingsRow href="/fitness?view=workouts" label="Workouts" value={String(s?.workouts.length ?? 0)} />
        </SettingsGroup>
        <SettingsGroup title="Nutrition">
          <SettingsRow
            href="/configuration?view=budget"
            label="Calorie budget"
            value={s?.calorieBudget ? `${n(s.calorieBudget)} kcal` : "Not set"}
          />
          <SettingsRow
            href="/configuration?view=macros"
            label="Protein & fibre"
            value={
              s?.proteinTarget || s?.fiberTarget
                ? `${s?.proteinTarget ? `${s.proteinTarget} g` : "–"} · ${s?.fiberTarget ? `${s.fiberTarget} g` : "–"}`
                : "Not set"
            }
          />
          <SettingsRow href="/configuration?view=meals" label="Meal tags" value={String(s?.mealTags.length ?? 0)} />
          <SettingsRow href="/fitness?view=weight" label="Weight plan" value={plan ? `${plan.targetKg} kg` : "Not set"} />
        </SettingsGroup>
      </div>
    </SectionPage>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="group-head">{title}</h3>
      <ul className="group-list">{children}</ul>
    </section>
  );
}

function SettingsRow({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <li>
      <Link href={href} className="group-row">
        <span className="flex-1">{label}</span>
        <span className="group-row__value">{value}</span>
        <ChevronRight className="group-row__chev" aria-hidden />
      </Link>
    </li>
  );
}

export default function ConfigurationPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  );
}
