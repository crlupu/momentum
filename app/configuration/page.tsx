"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
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
import { StyleSwitch, ThemeSwitch } from "@/components/ThemeSwitch";
import {
  Apple,
  ArrowDown,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  LogOut,
  Moon,
  Target,
  Tune,
  Warning,
} from "@/components/icons";
import { validPlan } from "@/lib/weight";
import type { Tracker } from "@/lib/tracker";

/** The settings each row opens, by the `view` it sets. */
const VIEWS: Record<string, { title: string; body: (t: Tracker) => ReactNode }> = {
  categories: { title: "Categories", body: (t) => <CategoriesCard tracker={t} /> },
  meals: { title: "Meal tags", body: (t) => <MealTagsCard tracker={t} /> },
  budget: { title: "Calorie budget", body: (t) => <CalorieBudgetCard tracker={t} /> },
  macros: { title: "Protein & fibre targets", body: (t) => <MacroTargetsCard tracker={t} /> },
  appearance: {
    title: "Appearance",
    body: () => (
      <div className="flex flex-col gap-3">
        <h3 className="group-head">Style</h3>
        <StyleSwitch />
        <h3 className="group-head mt-2">Light or dark</h3>
        <ThemeSwitch className="w-full" />
        <p className="text-[13px] text-[var(--muted)]">System follows your device&apos;s light or dark setting.</p>
      </div>
    ),
  },
};

/** Everything tracked, as one JSON file to keep. */
function exportData(t: Tracker) {
  if (!t.state) return;
  const blob = new Blob([JSON.stringify(t.state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `momentum-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Settings as one list: each kind of setting is a row showing its value,
 * opening a page of its own where it's edited.
 */
function Settings() {
  const tracker = usePageTracker();
  const view = useSearchParams().get("view");
  const s = tracker.state;
  const open = view ? VIEWS[view] : undefined;
  const appearance = useThemeName();

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
          <SettingsRow icon={<Tune />} href="/configuration?view=categories" label="Categories" value={String(s?.categories.length ?? 0)} />
          <SettingsRow icon={<Dumbbell />} href="/fitness?view=workouts" label="Workouts" value={String(s?.workouts.length ?? 0)} />
        </SettingsGroup>
        <SettingsGroup title="Nutrition">
          <SettingsRow
            icon={<Flame />}
            href="/configuration?view=budget"
            label="Calorie budget"
            value={s?.calorieBudget ? `${n(s.calorieBudget)} kcal` : "Not set"}
          />
          <SettingsRow
            icon={<BarChart3 />}
            href="/configuration?view=macros"
            label="Protein & fibre"
            value={
              s?.proteinTarget || s?.fiberTarget
                ? `${s?.proteinTarget ? `${s.proteinTarget} g` : "–"} · ${s?.fiberTarget ? `${s.fiberTarget} g` : "–"}`
                : "Not set"
            }
          />
          <SettingsRow icon={<Apple />} href="/configuration?view=meals" label="Meal tags" value={String(s?.mealTags.length ?? 0)} />
          <SettingsRow icon={<Target />} href="/fitness?view=weight" label="Weight plan" value={plan ? `${plan.targetKg} kg` : "Not set"} />
        </SettingsGroup>
        <SettingsGroup title="App">
          <SettingsRow icon={<Moon />} href="/configuration?view=appearance" label="Appearance" value={appearance} />
          <li className="group-row">
            <span className="settings-icon" aria-hidden>{tracker.syncError ? <Warning /> : <CheckCircle2 />}</span>
            <span className="flex-1">Sync</span>
            <span className="group-row__value">
              {!tracker.firebaseConfigured ? "This device only" : tracker.syncError ? "Not syncing" : "Up to date"}
            </span>
          </li>
          <li>
            <button type="button" className="group-row" onClick={() => exportData(tracker)}>
              <span className="settings-icon" aria-hidden><ArrowDown /></span>
              <span className="flex-1 text-start">Export data</span>
              <span className="group-row__value">JSON</span>
            </button>
          </li>
        </SettingsGroup>
        {tracker.user && (
          <ul className="group-list">
            <li>
              <button type="button" className="group-row justify-center text-[var(--danger)]" onClick={() => void tracker.signOutUser()}>
                <LogOut className="h-5 w-5" aria-hidden />
                Sign Out
              </button>
            </li>
          </ul>
        )}
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

/** The appearance setting, for the row's value; known only once mounted. */
function useThemeName(): string {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return "";
  return theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";
}

function SettingsRow({ href, label, value, icon }: { href: string; label: string; value: string; icon: ReactNode }) {
  return (
    <li>
      <Link href={href} className="group-row">
        <span className="settings-icon" aria-hidden>{icon}</span>
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
