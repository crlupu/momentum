/**
 * Section motifs.
 *
 * One mark per section, drawn in a single stroke weight on the section's own
 * colour plate. They follow the IBM Design Language illustration rules the app
 * is built on: flat, one idea per frame, depth from isometric projection rather
 * than shading, and strokes that run off the edge of the frame instead of being
 * politely centred inside it.
 *
 * The viewBox is 96x120 and the plate clips it, so each mark is a crop of a
 * larger drawing — that crop is what makes the band read as part of a grid.
 */

export type SectionId =
  | "goals"
  | "tasks"
  | "fitness"
  | "nutrition"
  | "charts"
  | "log"
  | "config";

const MOTIFS: Record<SectionId, React.ReactNode> = {
  /* Many paths converging on one point: several goals, one direction. */
  goals: (
    <g className="motif-stroke">
      <path d="M8 116 L104 12" />
      <path d="M8 116 L104 40" />
      <path d="M8 116 L104 68" />
      <path d="M8 116 L92 4" />
      <path d="M8 116 L68 4" />
      <path d="M8 116 L44 4" />
    </g>
  ),

  /* A run of checkboxes, the last one still open. */
  tasks: (
    <g className="motif-stroke">
      <rect x="46" y="6" width="24" height="24" />
      <path d="M52 18 l5 5 8 -10" />
      <rect x="62" y="46" width="24" height="24" />
      <path d="M68 58 l5 5 8 -10" />
      <rect x="46" y="86" width="24" height="24" />
    </g>
  ),

  /* The switchback: effort as a route that doubles back and keeps going. */
  fitness: (
    <>
      <path
        className="motif-stroke"
        d="M-6 22 C 30 22 22 60 46 60 C 70 60 62 98 100 98"
      />
      <circle className="motif-fill" cx="46" cy="60" r="6" />
    </>
  ),

  /* Stacked isometric plates: intake as things counted, one layer at a time. */
  nutrition: (
    <g className="motif-stroke">
      <path d="M48 46 L84 66 L48 86 L12 66 Z" />
      <path d="M12 66 L12 80 L48 100 L84 80 L84 66" />
      <path d="M48 86 L48 100" />
      <path className="motif-stroke--thin" d="M48 24 L84 44 L48 64 L12 44 Z" />
    </g>
  ),

  /* A reading lifting off the block it was measured from. */
  charts: (
    <g className="motif-stroke">
      <path d="M48 62 L84 82 L48 102 L12 82 Z" />
      <path d="M48 12 L84 32 L48 52 L12 32 Z" />
      <path className="motif-stroke--thin" d="M12 32 L12 82 M84 32 L84 82 M48 52 L48 102" />
      <path d="M34 32 L42 28 M46 37 L60 29 M58 43 L70 36" />
    </g>
  ),

  /* The eye: the log is the part of the app that only watches. */
  log: (
    <>
      <path
        className="motif-stroke"
        d="M-8 60 C 16 24 80 24 104 60 C 80 96 16 96 -8 60 Z"
      />
      <circle className="motif-fill" cx="48" cy="60" r="18" />
    </>
  ),

  /* Sliders at rest: settings as values already chosen. */
  config: (
    <g className="motif-stroke">
      <path d="M24 12 L24 108 M48 12 L48 108 M72 12 L72 108" />
      <rect x="15" y="40" width="18" height="11" fill="var(--band-color)" />
      <rect x="39" y="70" width="18" height="11" fill="var(--band-color)" />
      <rect x="63" y="28" width="18" height="11" fill="var(--band-color)" />
    </g>
  ),
};

export function SectionMotif({ id }: { id: SectionId }) {
  return (
    <svg viewBox="0 0 96 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {MOTIFS[id]}
    </svg>
  );
}

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
