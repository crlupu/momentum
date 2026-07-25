"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { Menu, X, Target, Repeat, BarChart3, Plus, LogOut } from "lucide-react";
import { ThemeSwitch } from "./ThemeSwitch";
import { Tracker } from "@/lib/tracker";

const NAV = [
  { id: "goals", label: "Goals", icon: Target },
  { id: "recurring", label: "Recurring", icon: Repeat },
  { id: "charts", label: "Progress", icon: BarChart3 },
];

export function Sidebar({
  tracker,
  onAddGoal,
  onAddRecurring,
}: {
  tracker: Tracker;
  onAddGoal: () => void;
  onAddRecurring: () => void;
}) {
  const [open, setOpen] = useState(false);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setOpen(false);
  };

  return (
    <>
      {/* Top bar with menu button — always visible; the menu is an overlay. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-foreground/10 bg-background/90 px-4 py-3 backdrop-blur">
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="text-foreground/80 hover:text-foreground">
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-display text-lg font-bold tracking-tight">Momentum</span>
      </div>

      {/* Overlay drawer */}
      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-foreground/10 bg-card shadow-2xl">
            <div className="flex h-full flex-col gap-1 p-4">
              <div className="mb-4 flex items-center justify-between px-1">
                <span className="font-display text-xl font-bold tracking-tight">Momentum</span>
                <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-foreground/50 hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-2 flex flex-col gap-2">
                <Button variant="primary" onPress={() => { onAddGoal(); setOpen(false); }} className="justify-start">
                  <Plus className="h-4 w-4" /> New goal
                </Button>
                <Button variant="outline" onPress={() => { onAddRecurring(); setOpen(false); }} className="justify-start">
                  <Plus className="h-4 w-4" /> New recurring task
                </Button>
              </div>

              <div className="my-2 h-px bg-foreground/10" />

              <nav className="flex flex-col gap-1">
                {NAV.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => go(n.id)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    <n.icon className="h-4 w-4" />
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
          </aside>
        </div>
      )}
    </>
  );
}
