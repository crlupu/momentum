"use client";

import { useState } from "react";
import { Button, Card, Chip, Input } from "@heroui/react";
import { Check, Plus, RotateCcw, SlidersHorizontal, Target, X } from "lucide-react";
import { ProgressRing } from "./ProgressRing";
import { Tracker, Goal, goalPct } from "@/lib/tracker";

function GoalCard({ g, tracker }: { g: Goal; tracker: Tracker }) {
  const c = tracker.cat(g.catId);
  const pct = goalPct(g);
  const hasTarget = typeof g.target === "number" && g.target > 0;

  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(String(g.current ?? ""));
  const [target, setTarget] = useState(String(g.target ?? ""));

  const save = () => {
    tracker.setGoalProgress(g.id, current === "" ? null : Number(current), target === "" ? null : Number(target));
    setEditing(false);
  };

  return (
    <Card>
      <Card.Content className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={"font-display text-base font-semibold " + (g.done ? "text-foreground/45 line-through" : "")}>
              {g.title}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Chip size="sm" variant="soft" className="cursor-pointer" onClick={() => tracker.cycleGoalCat(g.id)}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                <Chip.Label className="ml-1.5">{c.name}</Chip.Label>
              </Chip>
              {hasTarget && (
                <span className="font-mono-n text-xs text-foreground/50">
                  {g.current ?? 0} / {g.target}
                </span>
              )}
            </div>
          </div>
          {hasTarget && <ProgressRing pct={pct} color={c.color} size={56} />}
        </div>

        {hasTarget && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color, transition: "width .3s ease" }} />
          </div>
        )}

        {editing && (
          <div className="mt-3 flex flex-col gap-2">
            <label className="block text-[11px] text-foreground/60">
              Current
              <Input type="number" aria-label="Current value" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-0.5 w-full" />
            </label>
            <label className="block text-[11px] text-foreground/60">
              Target
              <Input type="number" aria-label="Target value" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-0.5 w-full" />
            </label>
            <Button size="sm" variant="primary" onPress={save} className="w-full">Save</Button>
            <Button size="sm" variant="ghost" onPress={() => setEditing(false)} className="w-full">Cancel</Button>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onPress={() => setEditing((v) => !v)}>
            {hasTarget ? <SlidersHorizontal className="h-4 w-4" /> : <Target className="h-4 w-4" />}
            {hasTarget ? "Update" : "Set target"}
          </Button>
          {g.done ? (
            <Button size="sm" variant="outline" onPress={() => tracker.toggleGoalDone(g.id)}>
              <RotateCcw className="h-4 w-4" /> Reopen
            </Button>
          ) : (
            <Button size="sm" variant="primary" onPress={() => tracker.toggleGoalDone(g.id)}>
              <Check className="h-4 w-4" /> Done
            </Button>
          )}
          <Button size="sm" variant="ghost" isIconOnly aria-label="Delete goal" onPress={() => tracker.deleteGoal(g.id)} className="ml-auto">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

export default function GoalsView({ tracker, onAdd }: { tracker: Tracker; onAdd: () => void }) {
  const s = tracker.state!;
  const active = s.goals.filter((g) => !g.done);
  const done = s.goals.filter((g) => g.done);
  const avg = active.length
    ? Math.round(active.reduce((a, g) => a + goalPct(g), 0) / active.length)
    : 0;

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Goals</h2>
          <p className="mt-0.5 text-sm text-foreground/60">
            {active.length} active · {done.length} done · {avg}% avg progress
          </p>
        </div>
        <Button variant="primary" onPress={onAdd}>
          <Plus className="h-4 w-4" /> New goal
        </Button>
      </div>

      {active.length === 0 && done.length === 0 ? (
        <Card>
          <Card.Content className="p-8 text-center">
            <Target className="mx-auto mb-3 h-8 w-8 text-foreground/30" />
            <p className="text-foreground/60">No goals yet. Add one to start tracking progress.</p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
          {active.map((g) => (
            <GoalCard key={g.id} g={g} tracker={tracker} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="mb-3 mt-6 text-[13px] uppercase tracking-wide text-foreground/40">Completed</div>
          <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
            {done.map((g) => (
              <GoalCard key={g.id} g={g} tracker={tracker} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
