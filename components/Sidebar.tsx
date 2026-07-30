"use client";

import Link from "next/link";

import { useState } from "react";
import { Button } from "./ui";
import {
  Menu, X, Target, Repeat, BarChart3, ScrollText, Settings, Plus, LogOut, Dumbbell, Apple,
} from "lucide-react";
import { ThemeSwitch } from "./ThemeSwitch";
import { Logo } from "./Logo";
import { Tracker, caloriesLeftThisWeek, dateKey, recurringUnits } from "@/lib/tracker";

const NAV = [
  { id: "goals", label: "Goals", icon: Target, color: "var(--sec-goals)" },
  { id: "tasks", label: "Tasks", icon: Repeat, color: "var(--sec-tasks)" },
  { id: "fitness", label: "Fitness", icon: Dumbbell, color: "var(--sec-fitness)" },
  { id: "nutrition", label: "Nutrition", icon: Apple, color: "var(--sec-nutrition)" },
  { id: "charts", label: "Progress", icon: BarChart3, color: "var(--sec-charts)" },
  { id: "log", label: "Log", icon: ScrollText, color: "var(--sec-log)" },
  { id: "config", label: "Configuration", icon: Settings, color: "var(--sec-config)" },
];

/** One top-bar stat: the figure, then a filled colour-coded label beside it. */
function TopStat({
  value,
  label,
  bg,
}: {
  value: string | number;
  label: string;
  bg: string;
}) {
  // Every stat carries the same text colour; the category reads from the
  // tinted background and its dot, not from the type.
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 whitespace-nowrap text-foreground"
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${bg} 32%, transparent), color-mix(in srgb, ${bg} 12%, transparent))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${bg} 45%, transparent)`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0"
        style={{ background: bg }}
        aria-hidden
      />
      <span className="font-mono-n text-sm font-bold leading-none">{value}</span>
      <span className="text-[10px] font-semibold leading-none opacity-70">{label}</span>
    </span>
  );
}

function TopStats({ tracker }: { tracker: Tracker }) {
  const st = tracker.state;
  if (!st) return null;

  const today = dateKey();
  const units = recurringUnits(st.recurring, today);
  const done = units.filter((u) => u.done).length;
  const notDone = units.length - done;

  const openTodos = st.todos.filter((t) => !t.done).length;
  const latestWeight = st.weights.length ? st.weights[st.weights.length - 1].kg : null;
  const kcalToday = st.calories
    .filter((e) => e.date === today)
    .reduce((a, e) => a + e.kcal, 0);
  const kcalLeft = caloriesLeftThisWeek(st.calories, st.calorieBudget);

  return (
    <div className="ml-auto flex items-center gap-3 overflow-x-auto pl-3">
      <TopStat value={done} label="done today" bg="#a7f0ba" />
      <TopStat value={notDone} label="not done" bg="#8a3ffc" />
      <TopStat value={openTodos} label="to do" bg="#33b1ff" />
      <TopStat value={latestWeight != null ? `${latestWeight}` : "—"} label="kg" bg="#0f62fe" />
      <TopStat value={kcalToday} label="kcal today" bg="#ff8389" />
      {kcalLeft != null && (
        <TopStat
          value={kcalLeft}
          label="kcal left / week"
          bg={kcalLeft >= 0 ? "#a7f0ba" : "#ff8389"}
        />
      )}
    </div>
  );
}

function SidebarInner({
  tracker,
  onAddGoal,
  onAddRecurring,
  onNavigate,
  onClose,
}: {
  tracker: Tracker;
  onAddGoal: () => void;
  onAddRecurring: () => void;
  onNavigate: (id: string) => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-1 p-4">
      <div className="mb-4 flex items-center justify-between px-1">
        <span className="flex items-center gap-2">
          <Logo className="h-5 w-auto text-[var(--c-blue-60)]" />
          <span className="font-display text-xl font-bold tracking-tight">Momentum</span>
        </span>
        {onClose && (
          <button aria-label="Close menu" onClick={onClose} className="text-foreground/50 hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-col gap-2">
        <Button variant="primary" onPress={onAddGoal} className="w-full justify-start">
          <Plus className="h-4 w-4" /> New goal
        </Button>
        <Button variant="outline" onPress={onAddRecurring} className="w-full justify-start">
          <Plus className="h-4 w-4" /> New recurring task
        </Button>
      </div>

      <div className="my-2 h-px bg-foreground/10" />

      <nav className="flex flex-col gap-1">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => onNavigate(n.id)}
            className="flex items-center gap-3 px-3 py-2.5 text-left text-[15px] text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <n.icon className="h-4 w-4" style={{ color: n.color }} />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex items-center justify-between pt-4">
        <ThemeSwitch />
        {tracker.user && (
          <Button size="sm" variant="ghost" isIconOnly aria-label="Sign out" onPress={() => tracker.signOutUser()}>
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  tracker,
  onAddGoal,
  onAddRecurring,
  onNavigate,
}: {
  tracker: Tracker;
  onAddGoal: () => void;
  onAddRecurring: () => void;
  /** Lets the page open a collapsed section before we scroll to it. */
  onNavigate?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const go = (id: string) => {
    setOpen(false);
    onNavigate?.(id);
    // Let the section expand before scrolling, or we'd aim at the old height.
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  return (
    <>
      {/* Top bar: menu button, logo, stats. The menu is always an overlay. */}
      <div className="app-bar sticky top-0 z-30 flex items-center gap-3 px-4 py-3">
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="text-foreground/80 hover:text-foreground"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link href="/" className="flex shrink-0 items-center" aria-label="Momentum home">
          <Logo className="h-6 w-auto text-[var(--c-blue-60)]" />
        </Link>
        <TopStats tracker={tracker} />
      </div>

      {/* Overlay drawer */}
      {open && (
        <div className="fixed inset-0 z-40">
          <div className="scrim absolute inset-0" onClick={() => setOpen(false)} aria-hidden />
          <aside
            className="overlay-surface absolute inset-y-0 left-0 w-64 max-w-[85vw]"
            style={{ color: "var(--overlay-foreground)" }}
          >
            <SidebarInner
              tracker={tracker}
              onAddGoal={() => { onAddGoal(); setOpen(false); }}
              onAddRecurring={() => { onAddRecurring(); setOpen(false); }}
              onNavigate={go}
              onClose={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
