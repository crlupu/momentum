"use client";

import { FormEvent, useState } from "react";
import { Button, Input } from "@heroui/react";
import { Plus } from "lucide-react";
import { usePending } from "./ActionButton";
import { Tracker, WeightEntry, dateKey } from "@/lib/tracker";

const CARD = "#cce0ff"; // ADS blue subtler
const INK = "#09326c"; // ADS blue ink
const GRID = "rgba(0,0,0,0.12)";
const LABEL = "rgba(0,0,0,0.5)";

function lastNDays(n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

/** Always-visible 7-day chart. Days without an entry are simply gaps. */
function WeightChart({ weights }: { weights: WeightEntry[] }) {
  const W = 300;
  const H = 140;
  const pad = { l: 32, r: 12, t: 14, b: 22 };

  const days = lastNDays(7);
  const byDate = new Map(weights.map((w) => [w.date, w.kg]));
  const series = days.map((d, i) => ({ i, date: dateKey(d), kg: byDate.get(dateKey(d)) }));
  const present = series.filter((p) => typeof p.kg === "number") as { i: number; date: string; kg: number }[];

  // Y range: fit the visible week, or a neutral placeholder when empty.
  let lo = 0;
  let hi = 1;
  if (present.length) {
    const kgs = present.map((p) => p.kg);
    const min = Math.min(...kgs);
    const max = Math.max(...kgs);
    const span = max - min || 2;
    lo = min - span * 0.25;
    hi = max + span * 0.25;
  }

  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / 6;
  const y = (kg: number) => H - pad.b - ((kg - lo) / (hi - lo)) * (H - pad.t - pad.b);

  const gridYs = [pad.t, (pad.t + (H - pad.b)) / 2, H - pad.b];
  const pts = present.map((p) => `${x(p.i)},${y(p.kg)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Weight over the last 7 days">
      {/* grid + y labels (labels only when there's data to scale to) */}
      {gridYs.map((yy, idx) => (
        <g key={idx}>
          <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke={GRID} strokeWidth="1" />
          {present.length > 0 && (
            <text x={pad.l - 6} y={yy + 3} textAnchor="end" fill={LABEL} className="font-mono-n" fontSize="9">
              {(idx === 0 ? hi : idx === 1 ? (hi + lo) / 2 : lo).toFixed(1)}
            </text>
          )}
        </g>
      ))}

      {/* line through logged days */}
      {present.length > 1 && (
        <polyline points={pts} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {present.map((p) => (
        <circle key={p.date} cx={x(p.i)} cy={y(p.kg)} r="3.5" fill={INK}>
          <title>{`${p.date}: ${p.kg} kg`}</title>
        </circle>
      ))}

      {/* x labels: every day of the window */}
      {series.map((p, i) => (
        <text key={p.date} x={x(i)} y={H - 7} textAnchor="middle" fill={LABEL} className="font-mono-n" fontSize="9">
          {Number(p.date.slice(8))}
        </text>
      ))}
    </svg>
  );
}

export default function WeightTracker({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const data = s.weights;
  const latest = data.length ? data[data.length - 1] : null;
  const [kg, setKg] = useState("");

  const { pending, run } = usePending();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kg);
    if (!Number.isFinite(v) || v <= 0 || pending) return;
    const ok = await run(() => tracker.addWeight(v));
    if (ok) setKg("");
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-lg font-bold tracking-tight">Weight</h2>
        {latest && (
          <span className="font-mono-n text-sm text-foreground/60">
            {latest.kg} kg · {latest.date.slice(5)}
          </span>
        )}
      </div>

      <div className="rounded-[22px] p-4 sm:p-5" style={{ background: CARD, color: INK }}>
        <form onSubmit={submit} className="mb-3 flex gap-2">
          <Input
            type="number"
            step="0.1"
            aria-label="Weight in kg"
            placeholder="kg today…"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            isIconOnly
            aria-label="Add"
            isDisabled={pending}
            className={pending ? "is-pending" : ""}
            style={{ background: INK, color: CARD }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="mb-1 text-[11px] font-semibold" style={{ color: "rgba(0,0,0,0.55)" }}>
          Last 7 days
        </div>
        <WeightChart weights={data} />
      </div>
    </div>
  );
}
