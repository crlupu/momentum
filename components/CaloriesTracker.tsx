"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "./ui";
import { Plus, Pencil, Check, X } from "lucide-react";
import { usePending } from "./ActionButton";
import { DeleteButton } from "./DeleteButton";
import { Tracker, dateKey, CalorieEntry, UNTAGGED_COLOR } from "@/lib/tracker";

/** Section accent; follows the theme so it stays visible on dark. */
const ACCENT = "var(--sec-calories)";
const LABEL = "var(--muted)";
const TRACK = "var(--default)";

function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return dateKey(d);
}

export default function CaloriesTracker({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const [kcal, setKcal] = useState("");

  const totals: Record<string, number> = {};
  for (const e of s.calories) totals[e.date] = (totals[e.date] ?? 0) + e.kcal;

  const today = dateKey();
  const todayTotal = totals[today] ?? 0;

  const weekStart = mondayOfThisWeek();
  const weekDays = Object.entries(totals).filter(([d]) => d >= weekStart && d <= today);
  const weekSum = weekDays.reduce((a, [, v]) => a + v, 0);
  const weekAvg = weekDays.length ? Math.round(weekSum / weekDays.length) : 0;

  const days = Array.from({ length: 14 }, (_, i) => offsetDate(13 - i));
  const counts = days.map((d) => totals[dateKey(d)] ?? 0);
  const max = Math.max(1, ...counts);

  // Entries for a day in the order they were logged: the first one eaten sits
  // at the bottom of that day's bar.
  const entriesByDate: Record<string, CalorieEntry[]> = {};
  for (const e of s.calories) (entriesByDate[e.date] ??= []).push(e);

  const tagOf = (id?: string) => s.mealTags.find((m) => m.id === id);
  const colorOf = (id?: string) => tagOf(id)?.color ?? UNTAGGED_COLOR;

  const [tagId, setTagId] = useState<string>("");
  const todayEntries = entriesByDate[today] ?? [];

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kcal);
    if (!Number.isFinite(v) || v <= 0 || pending) return;
    const ok = await run(() => tracker.addCalories(v, tagId || undefined));
    if (ok) setKcal("");
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="sec-dot" style={{ background: "var(--grad-magenta)" }} aria-hidden />
          Calories
        </h2>
        <span className="font-mono-n text-sm text-foreground/60">{todayTotal} kcal today</span>
      </div>

      <div className="card p-4 sm:p-5">
        <form onSubmit={submit} className="mb-3 space-y-2">
          <div className="flex gap-2">
            <Input
              type="number"
              aria-label="Calories to add"
              placeholder="add kcal…"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              isIconOnly
              aria-label="Add"
              isDisabled={pending}
              className={pending ? "is-pending" : ""}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {s.mealTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {s.mealTags.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTagId(tagId === m.id ? "" : m.id)}
                  className="cat-chip"
                  style={{
                    ["--chip-color" as string]: m.color,
                    opacity: tagId && tagId !== m.id ? 0.45 : 1,
                    outline: tagId === m.id ? `1px solid ${m.color}` : undefined,
                  }}
                  aria-pressed={tagId === m.id}
                >
                  <span className="cat-chip__dot" aria-hidden />
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-mono-n text-xl font-bold" style={{ color: ACCENT }}>
            {weekAvg}
          </span>
          <span className="text-xs" style={{ color: LABEL }}>avg kcal/day · this week</span>
        </div>

        {todayEntries.length > 0 && (
          <div className="mb-3 border-t border-foreground/10 pt-2">
            {todayEntries.map((e) => (
              <EntryRow key={e.id} tracker={tracker} entry={e} color={colorOf(e.tagId)} />
            ))}
          </div>
        )}

        {s.calories.length === 0 ? (
          <p className="px-1 py-2 text-[15px]" style={{ color: LABEL }}>
            Add entries to see daily totals.
          </p>
        ) : (
          <div className="flex h-[120px] items-end gap-1 pt-1">
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="font-mono-n text-[9px] font-bold">{counts[i] || ""}</span>
                {/* Stacked in reverse so the first entry of the day is lowest. */}
                <div
                  className="flex w-full max-w-[22px] flex-col-reverse overflow-hidden rounded-t"
                  style={{
                    height: Math.max(2, (counts[i] / max) * 84),
                    background: counts[i] ? undefined : TRACK,
                  }}
                >
                  {(entriesByDate[dateKey(d)] ?? []).map((e) => (
                    <div
                      key={e.id}
                      title={`${tagOf(e.tagId)?.name ?? "Untagged"} · ${e.kcal} kcal`}
                      style={{
                        height: `${(e.kcal / (counts[i] || 1)) * 100}%`,
                        background: colorOf(e.tagId),
                      }}
                    />
                  ))}
                </div>
                <span
                  className="text-[9px] leading-none tabular-nums"
                  style={{ color: LABEL }}
                >
                  {d.getDate()}
                </span>
              </div>
            ))}
          </div>
        )}

        {s.mealTags.length > 0 && s.calories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {s.mealTags.map((m) => (
              <span key={m.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: LABEL }}>
                <span className="inline-block h-2 w-2" style={{ background: m.color }} aria-hidden />
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One of today's entries, editable in place. */
function EntryRow({
  tracker,
  entry,
  color,
}: {
  tracker: Tracker;
  entry: CalorieEntry;
  color: string;
}) {
  const s = tracker.state!;
  const [editing, setEditing] = useState(false);
  const [kcal, setKcal] = useState(String(entry.kcal));
  const [tagId, setTagId] = useState(entry.tagId ?? "");
  const { pending, run } = usePending();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kcal);
    if (!Number.isFinite(v) || v <= 0 || pending) return;
    const ok = await run(() => tracker.updateCalorieEntry(entry.id, v, tagId || undefined));
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2 py-1.5">
        <Input
          type="number"
          aria-label="Calories"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          className="w-24"
          autoFocus
        />
        <select
          aria-label="Meal"
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          className="h-10 min-w-[7rem] flex-1 px-2 text-sm"
        >
          <option value="">Untagged</option>
          {s.mealTags.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="primary" isIconOnly aria-label="Save entry" isDisabled={pending}>
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Cancel"
          onPress={() => {
            setKcal(String(entry.kcal));
            setTagId(entry.tagId ?? "");
            setEditing(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </form>
    );
  }

  const tagName = s.mealTags.find((m) => m.id === entry.tagId)?.name ?? "Untagged";
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">{tagName}</span>
      <span className="font-mono-n shrink-0 text-sm font-semibold tabular-nums">{entry.kcal}</span>
      <Button size="sm" variant="outline" isIconOnly aria-label={`Edit ${tagName} entry`} onPress={() => setEditing(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <DeleteButton
        what={`this ${entry.kcal} kcal entry`}
        iconOnly
        onDelete={() => tracker.removeCalorieEntry(entry.id)}
      />
    </div>
  );
}
