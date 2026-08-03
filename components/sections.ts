/**
 * The sections, in page order.
 *
 * Single source of truth for id, title and the index shown beside each
 * section heading. Order here *is* the index, so it can't drift out of step
 * with the page the way a parallel map could.
 */

export type SectionId =
  | "goals"
  | "tasks"
  | "fitness"
  | "nutrition"
  | "books"
  | "charts"
  | "log"
  | "config";

/**
 * The sections, in page order. Single source of truth for id, title and the
 * index shown in each band's eyebrow — the order here *is* the order, so it
 * can't drift out of step with the page the way a parallel map could.
 */
export const SECTIONS = [
  { id: "goals", title: "Goals" },
  { id: "tasks", title: "Tasks" },
  { id: "fitness", title: "Fitness" },
  { id: "nutrition", title: "Nutrition" },
  { id: "books", title: "Books" },
  { id: "charts", title: "Progress" },
  { id: "log", title: "Log" },
  { id: "config", title: "Configuration" },
] as const satisfies ReadonlyArray<{ id: SectionId; title: string }>;

/** Zero-padded position in the list above, e.g. "03". */
export function sectionIndex(id: SectionId): string {
  return String(SECTIONS.findIndex((s) => s.id === id) + 1).padStart(2, "0");
}

export function sectionTitle(id: SectionId): string {
  return SECTIONS.find((s) => s.id === id)!.title;
}
