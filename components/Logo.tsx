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
 * merged silhouette. The joints come to 1.3%.
 *
 * Square-cut, one colour, no gradient — the same rules as the rest of the app.
 * The reference image had rounded caps; those are dropped deliberately.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 30"
      className={className}
      role="img"
      aria-label="Momentum"
      fill="currentColor"
    >
      <polygon points="2.0,22.6 7.6,28.4 24.8,11.7 19.3,6.0" />
      <polygon points="18.2,23.7 25.4,27.3 35.9,5.7 28.7,2.2" />
      <polygon points="34.8,25.5 42.8,25.5 42.8,1.5 34.8,1.5" />
    </svg>
  );
}
