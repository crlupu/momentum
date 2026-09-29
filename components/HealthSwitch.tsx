"use client";

import Link from "next/link";
import { HEALTH, sectionPath, sectionTitle, type SectionId } from "./sections";

/**
 * Fitness and Nutrition share the Health tab. This is how you move between
 * them: a segmented control under the large title, each side a link, so the
 * pages keep their own addresses and the browser's back button still works.
 */
export function HealthSwitch({ current }: { current: SectionId }) {
  return (
    <nav className="seg health-switch" aria-label="Health">
      {HEALTH.map((id) => (
        <Link
          key={id}
          href={sectionPath(id)}
          className="seg__btn"
          aria-current={id === current ? "page" : undefined}
          replace
        >
          {sectionTitle(id)}
        </Link>
      ))}
    </nav>
  );
}
