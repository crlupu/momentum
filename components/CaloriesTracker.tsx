"use client";

import { FormEvent, useState } from "react";
import { Input, AddButton } from "./ui";
import { fmtDateAuto } from "@/lib/dates";
import { Apple, CalendarDays, MoreHorizontal } from "./icons";
import { ActionMenu } from "./Menu";
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

/** Today's kcal as a ring filling toward the day's budget, on the hero card. */
function KcalRing({ today, budget }: { today: number; budget?: number }) {
  const size = 84;
  const stroke = 8;
  const r = size / 2 - stroke / 2;
  const circ = 2 * Math.PI * r;
  const frac = budget ? Math.min(1, today / budget) : 0;
  const over = !!budget && today > budget;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={budget ? `${today} of ${budget} kcal today` : `${today} kcal today`}
      className="flex-none"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={over ? "var(--warning)" : "var(--accent)"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - frac)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        opacity={frac > 0 ? 1 : 0}
      />
    </svg>
  );
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

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kcal);
    if (!Number.isFinite(v) || v <= 0 || pending) return;
    setKcal("");
    // An empty picker means today rather than nothing: the date is optional,
    // and a cleared field should not stop an entry being logged.
    const ok = await run(() => tracker.addCalories(v, tagId || undefined, date || today));
    if (!ok) setKcal(String(v));
  };

  if (view === "today") {
    return (
      <div className="space-y-5">
        {/* The tab's hero: today's figure, the ring toward the day's budget
            beside it, and the week underneath. */}
        <section className="hero kcal-hero" aria-label="Calories today">
          <div className="kcal-hero__top">
            <div className="min-w-0">
              <p className="eyebrow">Today</p>
              <p className="kcal-now__fig">{todayTotal.toLocaleString()}</p>
              <p className="hero__meta">
                {s.calorieBudget
                  ? todayTotal <= s.calorieBudget
                    ? `of ${s.calorieBudget.toLocaleString()} kcal · ${(s.calorieBudget - todayTotal).toLocaleString()} left`
                    : `of ${s.calorieBudget.toLocaleString()} kcal · ${(todayTotal - s.calorieBudget).toLocaleString()} over`
                  : "kcal today"}
              </p>
            </div>
            <KcalRing today={todayTotal} budget={s.calorieBudget} />
          </div>
          <p className="hero__meta kcal-hero__week">
            This week · {weekAvg.toLocaleString()} a day on average
            {weekLeft != null && ` · ${weekLeft >= 0 ? `${weekLeft.toLocaleString()} left` : `${(-weekLeft).toLocaleString()} over`}`}
          </p>
        </section>

        <div className="card p-4">
          <form onSubmit={submit} className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="numeric"
                aria-label="Calories to add"
                placeholder="Add kcal…"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
                className="min-w-0 flex-1"
              />
              {/* Just the icon. A date field spells out a date that is almost
                  always today, taking a third of the row to say so; the icon
                  turns accent-coloured on the days it is not, which is the only
                  time the date is worth reading.

                  The real input lies over the icon at zero opacity rather than
                  beside it. Tapping it opens the platform's own date picker —
                  the wheel on a phone — which is what makes this work without
                  showPicker(), whose support is patchier than a tap's. */}
              <span className="relative shrink-0">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-[var(--r-control)] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                  style={{
                    background: loggingToday ? "var(--default)" : "var(--accent-soft)",
                    color: loggingToday ? "var(--muted)" : "var(--accent-text)" }}
                  aria-hidden
                >
                  <CalendarDays className="h-4 w-4" />
                </span>
                <input
                  type="date"
                  aria-label="Date to log against"
                  value={date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </span>
              <AddButton type="submit" aria-label="Add" isDisabled={pending} />
            </div>
            {s.mealTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Meal">
                {s.mealTags.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    onClick={() => setTagId(tagId === m.id ? "" : m.id)}
                    className="cat-chip meal-chip"
                    style={{ ["--chip-color" as string]: m.color }}
                    aria-checked={tagId === m.id}
                  >
                    <span className="cat-chip__dot" aria-hidden />
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {todayEntries.length > 0 && (
          <section>
            <h3 className="group-head">Today</h3>
            <ul className="group-list">
              {todayEntries.map((e) => {
                const time = e.at ? new Date(e.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;
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
