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
 * The sections, in menu order. Single source of truth for id, title and the
 * page each one lives on — the order here *is* the order, so it can't drift
 * out of step with the menu the way a parallel map could.
 *
 * Today is the home page; every other section has a page of its own.
 */
export const SECTIONS = [
  { id: "tasks", title: "Today", path: "/" },
  { id: "goals", title: "Goals", path: "/goals" },
  { id: "fitness", title: "Fitness", path: "/fitness" },
  { id: "nutrition", title: "Nutrition", path: "/nutrition" },
  { id: "books", title: "Books", path: "/books" },
  { id: "charts", title: "Progress", path: "/progress" },
  { id: "log", title: "Log", path: "/log" },
  { id: "config", title: "Settings", path: "/configuration" },
] as const satisfies ReadonlyArray<{ id: SectionId; title: string; path: string }>;

export function sectionTitle(id: SectionId): string {
  return SECTIONS.find((s) => s.id === id)!.title;
}

export function sectionPath(id: SectionId): string {
  return SECTIONS.find((s) => s.id === id)!.path;
}

/** Trailing slashes are emitted for static hosting; compare without them. */
export const trimPath = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** The section a path belongs to; the home page for anything unknown. */
export function sectionForPath(path: string): SectionId {
  const p = trimPath(path);
  return SECTIONS.find((s) => trimPath(s.path) === p)?.id ?? "tasks";
}
