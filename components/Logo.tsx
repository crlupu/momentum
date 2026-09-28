"use client";

/**
 * The Momentum mark: an M that climbs.
 *
 * One continuous stroke through five points. Each foot of the M lands higher
 * than the last (80, then 62, then 44) and the second peak stands above the
 * first, so the letter reads left to right as progress building on itself.
 *
 * Two layers, as an app icon would have: the first half of the stroke, where
 * it has come from, sits back in a translucent layer; the second half, the
 * climb, is solid. Round caps and joins, and a stroke a sixth of the mark's
 * width, so it holds up at the 20 pixels the sidebar shows it at.
 *
 * public/logo.svg and the PNG icons in public/icons are this same geometry,
 * white on an electric-blue tile.
 */

/** The stroke's points, in a 100-unit box. */
export const MARK_POINTS: [number, number][] = [
  [20, 80],
  [30, 40],
  [50, 62],
  [72, 20],
  [80, 44],
];
export const MARK_STROKE = 16;
/** The points from here on are the solid layer. */
const SOLID_FROM = 2;

/** The mark's box, stroke included: 12 to 88 on both axes. */
const VIEWBOX = "12 12 76 76";

const d = (pts: [number, number][]) => "M" + pts.map((p) => p.join(" ")).join(" L");

/**
 * The mark in the app's colours: electric blue, the path so far at 45%.
 * Pass `mono` to draw it in currentColor where the accent would clash.
 */
export function Logo({ className, mono }: { className?: string; mono?: boolean }) {
  const color = mono ? "currentColor" : "var(--accent)";
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: MARK_STROKE,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox={VIEWBOX} className={className} role="img" aria-label="Momentum">
      <path d={d(MARK_POINTS.slice(0, SOLID_FROM + 1))} strokeOpacity={0.45} {...common} />
      <path d={d(MARK_POINTS.slice(SOLID_FROM))} {...common} />
    </svg>
  );
}
