"use client";

/**
 * The Momentum mark: a domino chain mid-topple.
 *
 * Three bars. The leftmost has fallen furthest, the middle is mid-fall against
 * it, the rightmost is still standing. Read left to right it's the premise of
 * the app — start tracking one small thing and it knocks the next one over,
 * and the next.
 *
 * The three overlap rather than sitting apart, which is the part that carries
 * the meaning: separate bars are three objects, a touching chain is one
 * causal sequence. Verified as a single connected region when rasterised at
 * 48, 24 and 16px, so it never breaks into fragments at favicon size.
 *
 * Square-cut, one colour, no gradient — the same rules as the rest of the
 * app. The reference image had rounded caps; those are dropped deliberately,
 * since nothing else here carries a radius.
 *
 * Angles are 62°, 34° and 0° from upright, solved for the least overlap that
 * still keeps the chain in one piece inside the viewBox.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Momentum"
      fill="currentColor"
    >
      <polygon points="5.9,39.0 10.1,47.0 40.1,31.0 35.9,23.1" />
      <polygon points="20.3,40.5 27.7,45.5 46.7,17.3 39.3,12.3" />
      <polygon points="35.5,43.0 44.5,43.0 44.5,9.0 35.5,9.0" />
    </svg>
  );
}
