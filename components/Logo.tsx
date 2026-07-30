"use client";

/**
 * The Momentum mark.
 *
 * Four bars ascending left to right, each sheared forward. The ascent is the
 * tracking the app does — goals, weight, volume, macros all read as bars
 * elsewhere in the interface — and the shear is the momentum: the same figure
 * a bar chart makes, caught mid-motion.
 *
 * Flat, square-cut and drawn in a single colour, like everything else here.
 * It inherits currentColor so it can sit on any ground without carrying its
 * own palette decision.
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
      <polygon points="2,44 10,44 15,30 7,30" />
      <polygon points="13,44 21,44 26,22 18,22" />
      <polygon points="24,44 32,44 37,14 29,14" />
      <polygon points="35,44 43,44 48,6 40,6" />
    </svg>
  );
}
