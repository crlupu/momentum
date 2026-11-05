"use client";

import Link from "next/link";

/**
 * Routine's two views, today's habits and the week, as Health switches
 * between Fitness and Nutrition: a segmented control under the large title,
 * each side a link so the back button still works. The plan itself is
 * edited from Edit plan.
 */
export function RoutineSwitch({ current }: { current: "today" | "week" }) {
  return (
    <nav className="seg health-switch" aria-label="Routine">
      <Link
        href="/routine"
        className="seg__btn"
        aria-current={current === "today" ? "page" : undefined}
        replace
      >
        Today
      </Link>
      <Link
        href="/week"
        className="seg__btn"
        aria-current={current === "week" ? "page" : undefined}
        replace
      >
        Week
      </Link>
    </nav>
  );
}
