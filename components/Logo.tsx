"use client";

/**
 * The Momentum mark: a domino chain mid-topple.
 *
 * Three bars at 46, 26 and 0 degrees from upright — one fallen, one going
 * over, one still standing. Read left to right it's the app's premise: start
 * tracking one small thing and it knocks over the next, and the next.
 *
 * The bars meet at their edges rather than overlapping. Solved rather than
 * eyeballed: angles, bar length and base spacing were searched for the
 * steepest possible fall whose joints still share under 2% of a bar's area,
 * so the chain reads as three distinct dominoes in contact instead of one
 * merged silhouette.
 *
 * Drawn as rotated rectangles rather than polygons, because only a rect can
 * carry a corner radius. Each is the same bar — near enough 24 by 8 — turned
 * about its own centre. The radius is a quarter of the bar's width: enough to
 * read as rounded at the 20 pixels the mark is usually shown at, without the
 * ends going pill-shaped. The geometry is the polygons' own, squared up; they
 * were already within two thirds of a degree of true rectangles.
 */

/** One bar, three times over: position, size and the angle it has fallen to. */
const BARS = [
  { x: 1.438, y: 13.144, w: 23.974, h: 8.062, angle: -44.155, cx: 13.425, cy: 17.175 },
  { x: 15.042, y: 10.7, w: 24.017, h: 8.05, angle: -64.075, cx: 27.05, cy: 14.725 },
  { x: 26.8, y: 9.5, w: 24, h: 8, angle: -90, cx: 38.8, cy: 13.5 },
];

/** A quarter of the bar's width. */
const RADIUS = 2;

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 30"
      className={className}
      role="img"
      aria-label="Momentum"
      fill="currentColor"
    >
      {BARS.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={RADIUS}
          transform={`rotate(${b.angle} ${b.cx} ${b.cy})`}
        />
      ))}
    </svg>
  );
}
