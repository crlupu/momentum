"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { SummaryCard } from "@/components/SummaryCard";
import { SectionPage } from "@/components/Section";
import { ConfigCard } from "@/components/ConfigCard";
import { CategoriesCard, CalorieBudgetCard, MacroTargetsCard, MealTagsCard } from "@/components/Forms";
import { StyleSwitch, ThemeSwitch } from "@/components/ThemeSwitch";
import {
  ArrowDown,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Health,
  Kanban,
  LogOut,
  Minus,
  Moon,
  Person,
  Plus,
  School,
  Search,
  Target,
  Today,
  Tune,
  Upload,
  Warning,
} from "@/components/icons";
import { validPlan } from "@/lib/weight";
import { fmtDateAuto } from "@/lib/dates";
import { projectFinished } from "@/lib/projects";
import type { Tracker } from "@/lib/tracker";

/**
 * Settings, by area. The list mirrors the app's four tabs, then the app
 * itself: everything for one area is on one page, and a single number is
 * changed in place with − and + rather than on a page of its own. Search
 * finds any setting. On a phone the list and a page are separate screens;
 * on a desktop the list stays on the left and the page opens beside it.
 */

type PageId = "account" | "today" | "education" | "projects" | "health" | "appearance" | "data";

const PAGES: { id: PageId; title: string; sub: string; icon: ReactNode; group: "areas" | "app" }[] = [
  { id: "today", title: "Today", sub: "Categories", icon: <Today />, group: "areas" },
  { id: "education", title: "Education", sub: "Reading tracks, paths, phases", icon: <School />, group: "areas" },
  { id: "projects", title: "Projects", sub: "Projects, finished projects", icon: <Kanban />, group: "areas" },
  { id: "health", title: "Health", sub: "Workouts, weight plan, nutrition targets", icon: <Health />, group: "areas" },
  { id: "appearance", title: "Appearance", sub: "Style, light or dark", icon: <Moon />, group: "app" },
  { id: "data", title: "Data and sync", sub: "Export, import, account", icon: <ArrowDown />, group: "app" },
];

/** Every setting, for search: what it's called, words it answers to, and where it is. */
const INDEX: { label: string; words: string; page: PageId | string }[] = [
  { label: "Categories", words: "colours tags routines", page: "today" },
  { label: "Reading tracks", words: "books pages a day track", page: "education" },
  { label: "Paths", words: "goals learning", page: "education" },
  { label: "Phases", words: "quarter plan reading", page: "education" },
  { label: "Import a reading plan", words: "import books plan", page: "education" },
  { label: "Projects", words: "board cards tags", page: "projects" },
  { label: "Workouts", words: "exercises training gym", page: "health" },
  { label: "Weight plan", words: "target kg checkpoint", page: "health" },
  { label: "Calorie budget", words: "kcal food nutrition", page: "health" },
  { label: "Protein target", words: "macros grams nutrition", page: "health" },
  { label: "Fibre target", words: "fiber macros grams nutrition", page: "health" },
  { label: "Meal tags", words: "breakfast lunch dinner snack", page: "health" },
  { label: "Style", words: "theme signal blue neutral colours", page: "appearance" },
  { label: "Light or dark", words: "dark mode theme system", page: "appearance" },
  { label: "Sync", words: "cloud account firebase", page: "data" },
  { label: "Export data", words: "backup json download", page: "data" },
  { label: "Sign out", words: "account log out", page: "data" },
];

/** The older one-setting pages, kept so links to them still open. */
const LEGACY: Record<string, { title: string; body: (t: Tracker) => ReactNode }> = {
  categories: { title: "Categories", body: (t) => <CategoriesCard tracker={t} /> },
  meals: { title: "Meal tags", body: (t) => <MealTagsCard tracker={t} /> },
  budget: { title: "Calorie budget", body: (t) => <CalorieBudgetCard tracker={t} /> },
  macros: { title: "Protein & fibre targets", body: (t) => <MacroTargetsCard tracker={t} /> },
};

function Settings() {
  const tracker = usePageTracker();
  const view = useSearchParams().get("view");
  const legacy = view ? LEGACY[view] : undefined;
  const settingsLink = (
    <Link href="/configuration" className="back-link">
      <ChevronLeft aria-hidden />
      Settings
    </Link>
  );

  if (legacy) {
    return (
      <SectionPage id="config" title={legacy.title} subtitle={settingsLink}>
        <ConfigCard title="">{legacy.body(tracker)}</ConfigCard>
      </SectionPage>
    );
  }

  const page = PAGES.find((p) => p.id === view) ?? (view === "account" ? { id: "account" as const, title: "Account" } : null);
  return (
    <SectionPage id="config" title={page ? page.title : undefined} subtitle={page ? settingsLink : undefined}>
      <div className={"settings" + (page ? " settings--page" : " settings--home")}>
        <div className="settings__nav">
          <SettingsHome tracker={tracker} current={page?.id ?? null} />
        </div>
        <div className="settings__page">
          <h2 className="settings__page-title">{page?.title ?? "Today"}</h2>
          <PageBody id={page?.id ?? "today"} tracker={tracker} />
        </div>
      </div>
    </SectionPage>
  );
}

/** The list: search, the account, the four areas, then the app. */
function SettingsHome({ tracker, current }: { tracker: Tracker; current: PageId | null }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const hits = query ? INDEX.filter((x) => `${x.label} ${x.words}`.toLowerCase().includes(query)) : [];
  const style = useStyleName();
  const value: Partial<Record<PageId, string>> = {
    // The style alone: light or dark is on its page, and the row stays short.
    appearance: style,
    data: !tracker.firebaseConfigured ? "Off" : tracker.syncError ? "Not syncing" : "Up to date",
  };
  return (
    <div className="flex flex-col gap-5">
      <label className="settings-search">
        <Search aria-hidden />
        <input type="search" placeholder="Search settings" aria-label="Search settings" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {query ? (
        <section>
          <h3 className="group-head">Results</h3>
          {hits.length === 0 ? (
            <p className="card p-4 text-[15px] text-[var(--muted)]">Nothing matches “{q}”.</p>
          ) : (
            <ul className="group-list">
              {hits.map((h) => (
                <li key={h.label}>
                  <Link href={`/configuration?view=${h.page}`} className="group-row" onClick={() => setQ("")}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span>{h.label}</span>
                      <span className="text-[13px] text-[var(--muted)]">{PAGES.find((p) => p.id === h.page)?.title}</span>
                    </span>
                    <ChevronRight className="group-row__chev" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <SummaryCard
            className={"settings-account-card" + (current === "account" ? " is-current" : "")}
            label="Account"
            title={tracker.user ? "Your account" : "Not signed in"}
            line={tracker.user ? tracker.user.email ?? "Signed in" : "Everything is saved on this device."}
            band={{ label: "Sync", content: tracker.syncError ? "Not syncing" : tracker.user ? "Up to date" : "Off", action: "Open", href: "/configuration?view=account" }}
          />
          {(["areas", "app"] as const).map((g) => (
            <section key={g}>
              <h3 className="group-head">{g === "areas" ? "Your areas" : "App"}</h3>
              <ul className="group-list">
                {PAGES.filter((p) => p.group === g).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/configuration?view=${p.id}`}
                      className={"group-row" + (current === p.id ? " is-current" : "")}
                      aria-current={current === p.id ? "page" : undefined}
                    >
                      <span className="settings-icon" aria-hidden>{p.icon}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span>{p.title}</span>
                        {!value[p.id] && <span className="truncate text-[13px] text-[var(--muted)]">{p.sub}</span>}
                      </span>
                      {value[p.id] && <span className="group-row__value">{value[p.id]}</span>}
                      <ChevronRight className="group-row__chev" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function PageBody({ id, tracker }: { id: PageId; tracker: Tracker }) {
  const s = tracker.state!;
  switch (id) {
    case "today":
      return (
        <Group title="Categories" note="Each goal and to-do carries one; its colour marks it in lists and charts.">
          <ConfigCard title="">
            <CategoriesCard tracker={tracker} />
          </ConfigCard>
        </Group>
      );

    case "education":
      return (
        <>
          <Group title="Reading tracks">
            <ul className="group-list">
              {s.readingTracks.filter((t) => !t.archived).map((t) => (
                <Row
                  key={t.id}
                  href={`/education?track=${t.id}`}
                  icon={<span className="settings-dot" style={{ background: t.color }} />}
                  label={t.name}
                  sub={[t.dailyTarget > 0 ? `${t.dailyTarget} pages a day` : null, `${t.wipLimit} at a time`].filter(Boolean).join(" · ")}
                />
              ))}
              <Row href="/education" icon={<Plus />} label="New track" sub="From Education › Library" quiet />
            </ul>
          </Group>
          <Group title="Goals and plans">
            <ul className="group-list">
              <Row href="/education" icon={<School />} label="Paths" sub={s.paths.map((p) => p.title).join(", ") || "None yet"} value={String(s.paths.length)} />
              <Row href="/education?view=phases" icon={<CalendarDays />} label="Phases" sub="Plan reading by quarter" />
              <Row href="/education?view=phases" icon={<Upload />} label="Import a reading plan" sub="From text, on the Phases page" />
              <Row href="/education?view=history" icon={<Clock />} label="History" sub="Finished books and goals" />
            </ul>
          </Group>
        </>
      );

    case "projects": {
      const active = s.projects.filter((p) => !projectFinished(p));
      const finished = s.projects.length - active.length;
      return (
        <Group title="Projects" note="Tags are set on each project, from its Edit.">
          <ul className="group-list">
            {active.map((p) => (
              <Row key={p.id} href={`/projects?p=${p.id}`} icon={<Kanban />} label={p.title} sub={p.tags.length ? p.tags.map((t) => t.name).join(", ") : "No tags"} />
            ))}
            <Row href="/projects" icon={<CheckCircle2 />} label="Finished projects" value={String(finished)} />
          </ul>
        </Group>
      );
    }

    case "health": {
      const plan = validPlan(s.weightPlan);
      return (
        <>
          <Group title="Fitness">
            <ul className="group-list">
              <Row href="/fitness?view=workouts" icon={<Dumbbell />} label="Workouts" sub={s.workouts.map((w) => w.name).join(", ") || "None yet"} value={String(s.workouts.length)} />
              <Row href="/fitness?view=weight" icon={<Target />} label="Weight plan" sub={plan ? `${plan.targetKg} kg by ${fmtDateAuto(plan.targetDate)}` : "Not set"} />
            </ul>
          </Group>
          <Group title="Nutrition" note="Changed here, in place.">
            <ul className="group-list">
              <li className="group-row">
                <span className="settings-icon" aria-hidden><Flame /></span>
                <span className="flex-1">Calorie budget</span>
                <Stepper label="Calorie budget" value={s.calorieBudget} step={50} start={2000} unit="kcal" onChange={(v) => tracker.setCalorieBudget(v)} />
              </li>
              <li className="group-row">
                <span className="settings-icon" aria-hidden><BarChart3 /></span>
                <span className="flex-1">Protein target</span>
                <Stepper label="Protein target" value={s.proteinTarget} step={5} start={120} unit="g" onChange={(v) => tracker.setProteinTarget(v)} />
              </li>
              <li className="group-row">
                <span className="settings-icon" aria-hidden><BarChart3 /></span>
                <span className="flex-1">Fibre target</span>
                <Stepper label="Fibre target" value={s.fiberTarget} step={1} start={25} unit="g" onChange={(v) => tracker.setFiberTarget(v)} />
              </li>
              <li className="settings-chips">
                <span className="text-[13px] text-[var(--muted)]">Meal tags</span>
                <span className="flex flex-wrap gap-1.5">
                  {s.mealTags.map((m) => (
                    <span key={m.id} className="cat-chip meal-chip">{m.name}</span>
                  ))}
                  <Link href="/configuration?view=meals" className="cat-chip meal-chip">
                    Edit
                  </Link>
                </span>
              </li>
            </ul>
          </Group>
        </>
      );
    }

    case "appearance":
      return (
        <>
          <Group title="Style">
            <StyleSwitch />
          </Group>
          <Group title="Light or dark" note="System follows your device. Signal Blue turns stark white in light mode.">
            <ThemeSwitch className="w-full" />
          </Group>
        </>
      );

    case "data":
    case "account":
      return (
        <>
          <SummaryCard
            className="settings-sync-card"
            label="Sync"
            title={!tracker.firebaseConfigured ? "This device" : tracker.syncError ? "Not syncing" : "Up to date"}
            line={
              !tracker.firebaseConfigured
                ? "Everything is saved on this device."
                : tracker.syncError
                  ? "Your data is still saved on this device."
                  : "Saved on this device and in your account."
            }
            figures={[
              { value: tracker.state!.goals.length, label: "goals" },
              { value: tracker.state!.books.length, label: "books" },
              { value: tracker.state!.workoutSessions.length, label: "workouts logged" },
            ]}
          />
          <Group title="Export and import">
            <ul className="group-list">
              <li>
                <button type="button" className="group-row" onClick={() => exportData(tracker)}>
                  <span className="settings-icon" aria-hidden><ArrowDown /></span>
                  <span className="flex min-w-0 flex-1 flex-col text-start">
                    <span>Export everything</span>
                    <span className="text-[13px] text-[var(--muted)]">One JSON file</span>
                  </span>
                </button>
              </li>
              <Row href="/education?view=phases" icon={<BookOpen />} label="Import a reading plan" />
            </ul>
          </Group>
          <Group title="Account">
            <ul className="group-list">
              <li className="group-row">
                <span className="settings-icon" aria-hidden>{tracker.syncError ? <Warning /> : tracker.user ? <CheckCircle2 /> : <Person />}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{tracker.user ? "Signed in" : "Not signed in"}</span>
                  {tracker.user?.email && <span className="truncate text-[13px] text-[var(--muted)]">{tracker.user.email}</span>}
                </span>
              </li>
              {tracker.user && (
                <li>
                  <button type="button" className="group-row justify-center text-[var(--danger)]" onClick={() => void tracker.signOutUser()}>
                    <LogOut className="h-5 w-5" aria-hidden />
                    Sign out
                  </button>
                </li>
              )}
            </ul>
          </Group>
        </>
      );
  }
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <h3 className="group-head">{title}</h3>
      {children}
      {note && <p className="settings-group__note">{note}</p>}
    </section>
  );
}

function Row({ href, icon, label, sub, value, quiet }: { href: string; icon: ReactNode; label: string; sub?: string; value?: string; quiet?: boolean }) {
  return (
    <li>
      <Link href={href} className="group-row">
        <span className="settings-icon" aria-hidden>{icon}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={quiet ? "text-[var(--muted)]" : undefined}>{label}</span>
          {sub && <span className="truncate text-[13px] text-[var(--muted)]">{sub}</span>}
        </span>
        {value && <span className="group-row__value">{value}</span>}
        <ChevronRight className="group-row__chev" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * A number changed in place: − and + by a step, saved at once. Unset, it
 * reads "Not set" and + starts it from a sensible value; − at the bottom
 * clears it again.
 */
function Stepper({
  label,
  value,
  step,
  start,
  unit,
  onChange,
}: {
  label: string;
  value?: number | null;
  step: number;
  start: number;
  unit: string;
  onChange: (v: number | null) => unknown;
}) {
  const v = value ?? null;
  const down = () => onChange(v == null ? null : v - step <= 0 ? null : v - step);
  const up = () => onChange(v == null ? start : v + step);
  return (
    <span className="settings-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={down} disabled={v == null}>
        <Minus aria-hidden />
      </button>
      <span className="settings-stepper__value font-mono-n" aria-live="polite">
        {v == null ? "Not set" : `${v.toLocaleString()} ${unit}`}
      </span>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={up}>
        <Plus aria-hidden />
      </button>
    </span>
  );
}

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

/** The style, from <html data-style>, once mounted. */
function useStyleName(): string {
  const [name, setName] = useState("");
  useEffect(() => {
    const st = document.documentElement.dataset.style;
    setName(st === "signal" ? "Signal Blue" : st === "neutral" ? "Neutral" : "Signal Volt");
  }, []);
  return name;
}

export default function ConfigurationPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  );
}
