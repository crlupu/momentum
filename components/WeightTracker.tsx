"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Input } from "@heroui/react";
import { Tracker } from "@/lib/tracker";

const LINE = "#F5A524";

function WeightChart({ data }: { data: { date: string; kg: number }[] }) {
  const W = 300;
  const H = 130;
  const pad = { l: 30, r: 10, t: 12, b: 20 };
  const n = data.length;
  const kgs = data.map((d) => d.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const span = max - min || 1;
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;

  const x = (i: number) => (n <= 1 ? (W - pad.l - pad.r) / 2 + pad.l : pad.l + (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (kg: number) => H - pad.b - ((kg - lo) / (hi - lo)) * (H - pad.t - pad.b);

  const pts = data.map((d, i) => `${x(i)},${y(d.kg)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible" role="img" aria-label="Weight over time">
      {/* y guides */}
      {[hi, (hi + lo) / 2, lo].map((v, i) => {
        const yy = y(v);
        return (
          <g key={i}>
            <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke="currentColor" className="text-foreground/10" strokeWidth="1" />
            <text x={pad.l - 5} y={yy + 3} textAnchor="end" className="fill-foreground/40 font-mono-n" fontSize="9">
              {v.toFixed(1)}
            </text>
          </g>
        );
      })}
      {n > 1 && <polyline points={pts} fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {data.map((d, i) => (
        <circle key={d.date} cx={x(i)} cy={y(d.kg)} r="3" fill={LINE}>
          <title>{`${d.date}: ${d.kg} kg`}</title>
        </circle>
      ))}
      {/* first & last date labels */}
      {n >= 1 && (
        <>
          <text x={x(0)} y={H - 6} textAnchor="middle" className="fill-foreground/40 font-mono-n" fontSize="9">
            {data[0].date.slice(5)}
          </text>
          {n > 1 && (
            <text x={x(n - 1)} y={H - 6} textAnchor="middle" className="fill-foreground/40 font-mono-n" fontSize="9">
              {data[n - 1].date.slice(5)}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

export default function WeightTracker({ tracker }: { tracker: Tracker }) {
  const s = tracker.state!;
  const data = s.weights;
  const latest = data.length ? data[data.length - 1] : null;
  const [kg, setKg] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kg);
    if (!Number.isFinite(v) || v <= 0) return;
    tracker.addWeight(v);
    setKg("");
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

      <Card>
        <Card.Content className="px-3 py-3 sm:px-4">
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
            <Button type="submit" variant="primary">Add</Button>
          </form>

          {data.length === 0 ? (
            <p className="px-1 py-2 text-[15px] text-foreground/60">Add today&apos;s weight to start the chart.</p>
          ) : (
            <WeightChart data={data} />
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
