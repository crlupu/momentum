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
 * The sections, in menu order. Single source of truth for id, title, the page
 * each one lives on and the index shown in each band's eyebrow — the order
 * here *is* the order, so it can't drift out of step with the menu the way a
 * parallel map could.
 *
 * Goals are the home page; every other section has a page of its own.
 */
export const SECTIONS = [
  { id: "goals", title: "Goals", path: "/" },
  { id: "tasks", title: "Tasks", path: "/tasks" },
  { id: "fitness", title: "Fitness", path: "/fitness" },
  { id: "nutrition", title: "Nutrition", path: "/nutrition" },
  { id: "books", title: "Books", path: "/books" },
  { id: "charts", title: "Progress", path: "/progress" },
  { id: "log", title: "Log", path: "/log" },
  { id: "config", title: "Configuration", path: "/configuration" },
] as const satisfies ReadonlyArray<{ id: SectionId; title: string; path: string }>;

/** Zero-padded position in the list above, e.g. "03". */
export function sectionIndex(id: SectionId): string {
  return String(SECTIONS.findIndex((s) => s.id === id) + 1).padStart(2, "0");
}

export function sectionTitle(id: SectionId): string {
  return SECTIONS.find((s) => s.id === id)!.title;
}

export function sectionPath(id: SectionId): string {
  return SECTIONS.find((s) => s.id === id)!.path;
}
