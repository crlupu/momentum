export type SectionId =
  | "learning"
  | "projects"
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
  { id: "learning", title: "Education", path: "/education" },
  { id: "projects", title: "Projects", path: "/projects" },
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

/**
 * A place in the navigation. Most are one section; Health is two, Fitness
 * and Nutrition, which share a tab and switch between each other at the top
 * of the page.
 */
export type NavId = "tasks" | "learning" | "projects" | "health";

export const NAV: { id: NavId; title: string; sections: SectionId[] }[] = [
  { id: "tasks", title: "Today", sections: ["tasks"] },
  // Books are part of Education: /books only redirects there now.
  { id: "learning", title: "Education", sections: ["learning", "books"] },
  { id: "projects", title: "Projects", sections: ["projects"] },
  { id: "health", title: "Health", sections: ["fitness", "nutrition"] },
];

/** Where a nav place goes: its first section. */
export function navPath(id: NavId): string {
  return sectionPath(NAV.find((n) => n.id === id)!.sections[0]);
}

/** Whether a nav place holds the page at this path. */
export function navHolds(id: NavId, path: string): boolean {
  const p = trimPath(path);
  return NAV.find((n) => n.id === id)!.sections.some((s) => trimPath(sectionPath(s)) === p);
}

/** The Health pages, for the switch at the top of each. */
export const HEALTH: SectionId[] = ["fitness", "nutrition"];
