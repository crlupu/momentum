"use client";

import { FormEvent, useState } from "react";
import { fmtDateAuto, fmtTime } from "@/lib/dates";
import { Apple, CalendarDays, MoreHorizontal } from "./icons";
import { ActionMenu } from "./Menu";
import { CardMeter, SummaryCard } from "./SummaryCard";
import { MacroField } from "./QuickAdd";
import { usePending } from "./ActionButton";
import { Tracker, dateKey, CalorieEntry, UNTAGGED_COLOR } from "@/lib/tracker";
import { caloriesLeftThisWeek } from "@/lib/model";

/** Section accent; follows the theme so it stays visible on dark. */
const ACCENT = "var(--chart-1)";
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


export default function CaloriesTracker({ tracker, view = "today" }: { tracker: Tracker; view?: "today" | "trends" }) {
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

  const weekLeft = caloriesLeftThisWeek(s.calories, s.calorieBudget);
  const todaysMeals = s.calories.filter((e) => e.date === today);
  const macrosToday = s.macros.filter((m) => m.date === today);
  const protein = macrosToday.reduce((a, m) => a + (m.protein ?? 0), 0);
  const fiber = macrosToday.reduce((a, m) => a + (m.fiber ?? 0), 0);
  const todayEntries = s.calories.filter((e) => e.date === today);

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
  // The day the entry is logged against. Starts on today, so the common case
  // needs no thought; changing it is for catching up on a day already gone.
  const [date, setDate] = useState<string>(today);
  // Whether the picker is still pointing at today, which decides whether the
  // icon needs to draw attention to itself.
  const loggingToday = !date || date === today;

  const [proteinIn, setProteinIn] = useState("");
  const [fiberIn, setFiberIn] = useState("");
  // A comma is a decimal point too: phones in many locales type one.
  const num = (v: string) => Number(v.replace(",", ".")) || 0;
  const k = Math.round(num(kcal));
  const p = Math.round(num(proteinIn) * 10) / 10;
  const f = Math.round(num(fiberIn) * 10) / 10;
  const parts = [k > 0 ? `${k.toLocaleString()} kcal` : null, p > 0 ? `${p} g protein` : null, f > 0 ? `${f} g fibre` : null].filter(Boolean) as string[];

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parts.length || pending) return;
    const typed = { kcal, proteinIn, fiberIn };
    setKcal("");
    setProteinIn("");
    setFiberIn("");
    // An empty picker means today rather than nothing: the date is optional,
    // and a cleared field should not stop an entry being logged.
    const day = date || today;
    const ok = await run(async () => {
      let done = true;
      if (k > 0) done = (await tracker.addCalories(k, tagId || undefined, day)) !== false && done;
      if (p > 0 || f > 0) done = (await tracker.addMacros(p || null, f || null, day)) !== false && done;
      return done;
    });
    if (!ok) {
      setKcal(typed.kcal);
      setProteinIn(typed.proteinIn);
      setFiberIn(typed.fiberIn);
    }
  };

  if (view === "today") {
    return (
      <div className="space-y-5">
        {/* The tab's hero: today's figure, the ring toward the day's budget
            beside it, and the week underneath. */}
        <SummaryCard
          aria-label="Calories today"
          label="Today"
          aside={
            s.calorieBudget
              ? todayTotal <= s.calorieBudget
                ? `${(s.calorieBudget - todayTotal).toLocaleString()} left`
                : `${(todayTotal - s.calorieBudget).toLocaleString()} over`
              : undefined
          }
          figure={todayTotal.toLocaleString()}
          detail={s.calorieBudget ? `of ${s.calorieBudget.toLocaleString()} kcal` : "kcal today"}
          band={{
            label: "This week",
            content: `${weekAvg.toLocaleString()} a day on average`,
            action: weekLeft != null ? (weekLeft >= 0 ? `${weekLeft.toLocaleString()} left` : `${(-weekLeft).toLocaleString()} over`) : undefined,
            href: "/nutrition?view=trends",
          }}
          figures={[
            { value: Math.round(protein * 10) / 10, label: s.proteinTarget ? `/ ${s.proteinTarget} g protein` : "g protein" },
            { value: Math.round(fiber * 10) / 10, label: s.fiberTarget ? `/ ${s.fiberTarget} g fibre` : "g fibre" },
            { value: todaysMeals.length, label: todaysMeals.length === 1 ? "meal" : "meals" },
          ]}
        >
          {s.calorieBudget ? <CardMeter value={todayTotal / s.calorieBudget} accent /> : null}
        </SummaryCard>

        {/* One card logs the meal: calories large, protein and fibre under
            them, the day (only worth reading when it isn't today), the meal,
            and a button that says exactly what it will log. */}
        <form onSubmit={submit} className="card meal-log" aria-label="Log a meal">
          <div className="meal-log__head">
            <h3 className="meal-log__title">Log a meal</h3>
            {/* The real input lies over the icon at zero opacity, so a tap
                opens the platform's own date picker. */}
            <span className={"meal-log__date" + (loggingToday ? "" : " is-set")}>
              <CalendarDays aria-hidden />
              {!loggingToday && <span>{new Date(date + "T12:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</span>}
              <input type="date" aria-label="Date to log against" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </span>
          </div>
          <div className="meal-log__fields">
            <MacroField label="Calories" unit="kcal" whole ariaLabel="Calories" value={kcal} onChange={setKcal} className="macro-field--big" />
            <div className="meal-log__pair">
              <MacroField label="Protein" value={proteinIn} onChange={setProteinIn} />
              <MacroField label="Fibre" value={fiberIn} onChange={setFiberIn} />
            </div>
          </div>
          {s.mealTags.length > 0 && (
            <div className="meal-log__chips" role="radiogroup" aria-label="Meal">
              {s.mealTags.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  onClick={() => setTagId(tagId === m.id ? "" : m.id)}
                  className="weekly-cat"
                  aria-checked={tagId === m.id}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
          <button type="submit" className="pill-link pill-link--primary meal-log__save" disabled={pending || !parts.length}>
            {parts.length ? `Log ${parts.join(" \u00b7 ")}` : "Log meal"}
          </button>
        </form>

        {todayEntries.length > 0 && (
          <section>
            <h3 className="group-head">Today</h3>
            <ul className="group-list">
              {todayEntries.map((e) => {
                const time = e.at ? fmtTime(e.at) : null;
                const name = tagOf(e.tagId)?.name ?? time ?? "Meal";
                return (
                  <li key={e.id} className="group-row">
                    <span className="area-tile" aria-hidden>
                      <Apple />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span>{name}</span>
                      {tagOf(e.tagId) && time && <span className="text-[13px] text-[var(--muted)]">{time}</span>}
                    </span>
                    <span className="group-row__value font-mono-n">{e.kcal.toLocaleString()} kcal</span>
                    {/* Delete waits behind the row's menu rather than standing on every row. */}
                    <ActionMenu
                      label={`Actions for ${e.kcal} kcal`}
                      className="row-more"
                      items={[{ label: "Delete", danger: true, onSelect: () => void tracker.removeCalorieEntry(e.id) }]}
                    >
                      <MoreHorizontal aria-hidden />
                    </ActionMenu>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Calories, last two weeks">
      <h3 className="group-head">Calories · last two weeks</h3>
      <div className="card p-4 md:p-5">
        {s.calorieBudget ? (
          <p className="mb-3 text-[13px] text-[var(--muted)]">Budget {s.calorieBudget.toLocaleString()} a day</p>
        ) : null}
        {s.calories.length === 0 ? (
          <p className="px-1 py-2 text-[15px]" style={{ color: LABEL }}>
            Add entries to see daily totals.
          </p>
        ) : (
          <div className="flex h-[120px] items-end gap-1 pt-1">
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                {/* Only the highest day and today are labelled: a figure on
                    every bar crowded a phone and went unread. The rest are in
                    each bar's tooltip. */}
                <span className="font-mono-n whitespace-nowrap text-[11px] font-bold">
                  {/* "1.5k" rather than "1,500": the full figure was wider
                      than a phone's bar and ran past the card's edge. */}
                  {counts[i] && (i === days.length - 1 || counts[i] === max)
                    ? counts[i] >= 1000
                      ? `${(counts[i] / 1000).toFixed(1).replace(/\.0$/, "")}k`
                      : counts[i]
                    : ""}
                </span>
                {/* Stacked in reverse so the first entry of the day is lowest. */}
                <div
                  className="flex w-full max-w-[22px] flex-col-reverse overflow-hidden rounded-t-[3px]"
                  style={{
                    height: Math.max(2, (counts[i] / max) * 84),
                    background: counts[i] ? undefined : TRACK }}
                >
                  {(entriesByDate[dateKey(d)] ?? []).map((e, j, all) => (
                    <div
                      key={e.id}
                      title={`${fmtDateAuto(dateKey(d))} · ${tagOf(e.tagId)?.name ?? "Untagged"} · ${e.kcal} kcal (${counts[i]} that day)`}
                      style={{
                        height: `${(e.kcal / (counts[i] || 1)) * 100}%`,
                        background: colorOf(e.tagId),
                        // A 2px gap of the card's own colour between meals,
                        // drawn over the segment so the stack keeps its height.
                        boxShadow: j < all.length - 1 ? "inset 0 2px 0 var(--pane-bg)" : undefined }}
                    />
                  ))}
                </div>
                <span
                  className="text-[11px] leading-none tabular-nums"
                  style={{ color: LABEL }}
                >
                  {d.getDate()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Only the meals the bars actually show; none tagged, no legend. */}
        {s.mealTags.some((m) => s.calories.some((c) => c.tagId === m.id)) && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {s.mealTags.filter((m) => s.calories.some((c) => c.tagId === m.id)).map((m) => (
              <span key={m.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: LABEL }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
