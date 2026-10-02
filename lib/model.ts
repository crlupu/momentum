/**
 * Momentum's data model: the types of everything saved, and the plain
 * functions over them. No React and no Firebase, so the server (the Claude
 * connector, app/api/mcp) can use it as well as the app; the app's hook,
 * useTracker, is in lib/tracker.ts, which re-exports all of this.
 */
import { contrast } from "./color";
import * as R from "./reading";
import * as P from "./projects";
import type {
  BookStatus,
  BookQuote,
  ReadingPhase,
  ReadingSession,
  ReadingTrack,
  StatusChange,
} from "./reading";
export type Category = { id: string; name: string; color: string };

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly";
export const FREQUENCIES: Frequency[] = ["daily", "weekly", "biweekly", "monthly"];
export const FREQ_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};
export const FREQ_ORDER: Record<Frequency, number> = {
  daily: 0, weekly: 1, biweekly: 2, monthly: 3,
};

/** A set of interchangeable recurring tasks: doing one covers the whole set. */
export type RecurringGroup = { id: string; name: string };

export type RecurringTask = {
  id: string;
  title: string;
  catId: string;
  freq: Frequency;
  lastDone: string | null;
  groupId?: string;
};

// A goal is a progress-tracked objective (e.g. "Read Atomic Habits" 132/396).
export type Goal = {
  id: string;
  title: string;
  catId: string;
  current?: number;
  target?: number;
  done: boolean;
  /**
   * Where it stands: queued, active, done or dropped. The source of truth;
   * `done` is kept in step with it for older code and older copies of the
   * app. Absent on goals saved before statuses: see goalStatus.
   */
  status?: GoalStatus;
  /** A date it's aimed at (an exam), YYYY-MM-DD. Optional. */
  targetDate?: string;
  /** For a goal's own count: enough to count as covered, at most its target. */
  minimum?: number;
  /** Up to two reading phases it belongs to: the same phases books use. */
  phaseIds?: string[];
  doneDate?: string | null;
  /**
   * When it was ticked, as epoch milliseconds. The date alone puts everything
   * done on one day in an arbitrary order; this puts them in the order they
   * happened. Absent on anything recorded before timestamps existed, which the
   * log falls back from rather than guessing at.
   */
  doneAt?: number | null;
  /** Pinned goals stay at the top of their topic. */
  pinned?: boolean;
  /** Where it lives, e.g. the course page. */
  link?: string;
  /** Its description: details, in as many lines as it takes. */
  note?: string;
  /**
   * Its parts, each with a count of its own: a course's readings, problem
   * sets, project. A goal with parts takes its progress from them, and its
   * own count is set aside.
   */
  parts?: Part[];
};

export type GoalStatus = "queued" | "active" | "done" | "dropped";
export const GOAL_STATUSES: GoalStatus[] = ["queued", "active", "done", "dropped"];

/** A part of a goal: "Readings, 4 of 30". */
export type Part = {
  id: string;
  title: string;
  current: number;
  target: number;
  /** Enough to count as covered, at most the target: Projects 2 of 4. Optional. */
  minimum?: number;
};

/**
 * A topic: several goals grouped under one heading — "Backend engineering",
 * "Side projects" — shown as a section of the Goals page with its combined
 * progress. Stored as a "path" for continuity with saved data.
 *
 * Holds its goals by id rather than owning them, so a goal is the same goal
 * whether it is on a path or not: it keeps its figures and its
 * place in the goals list, and can be worked on without going through the
 * path. The path adds sequence and a total, nothing else.
 */
export type Path = {
  id: string;
  title: string;
  /** What it is for, in a sentence. Optional; plenty need no explaining. */
  note?: string;
  catId?: string;
  /** Its goals, in the order they are meant to be taken. */
  goalIds: string[];
};

/** A one-off task: just a title and a tick. */
export type TodoItem = {
  id: string;
  title: string;
  done: boolean;
  doneDate?: string | null;
  /** When it was ticked. See Goal.doneAt. */
  doneAt?: number | null;
};

export type Completion = {
  date: string;
  /** When it was ticked. See Goal.doneAt. */
  at?: number;
  catId: string;
  /** Set when the completion came from a group — one entry per group, not per task. */
  groupId?: string;
  /** Which task was actually ticked. */
  taskId?: string;
};

export type WeightEntry = { date: string; kg: number };

/**
 * A stretch of cardio, in minutes. Kept separate from workout sessions because
 * it carries no volume: it is time spent, not weight moved, and averaging the
 * two into one number would describe neither.
 *
 * Several a day are allowed — a bike before lifting and a walk after are two
 * efforts, not one — so each has an id and the day's total is their sum.
 */
export type CardioEntry = { id: string; date: string; minutes: number; at?: number };

/** A meal category — breakfast, coffee, and so on — with its own colour. */
export type MealTag = { id: string; name: string; color: string };

/**
 * A book on the shelf. `pages` is the length, `read` how far in.
 *
 * Both are kept rather than a percentage, because the percentage is what is
 * drawn and the pages are what is known: the number on the page you stopped
 * at. Storing the derived figure would mean recomputing it by hand every time
 * a length turned out to be wrong.
 */
export type Book = {
  id: string;
  title: string;
  /** Optional: plenty of books are known by title alone. */
  author?: string;
  pages: number;
  read: number;
  /** Cover colour, picked when the book is added. */
  color?: string;
  /**
   * Open Library's id for the cover image.
   *
   * Three states, and the difference matters: undefined means it has not been
   * looked up, null means it was looked up and there is no cover, and a string
   * is the cover. Without the null the app would ask again on every load for
   * every book that hasn't got one.
   */
  coverId?: string | null;
  /** A cover image of the reader's own, by address. Wins over coverId. */
  coverImage?: string;
  /** Which lookup filled this book in (see LOOKUP_VERSION); older ones are looked up again. */
  lookup?: number;
  /** Its category as Google Books files it: "Computers", "Self-Help". */
  category?: string;
  /** The day it was finished. */
  doneDate?: string;

  // ---- reading plan (see lib/reading.ts) ----
  /** The track it is read in. */
  trackId: string;
  status: BookStatus;
  /** Position in its track's queue; lower is sooner. */
  queueOrder: number;
  /**
   * Progress no session accounts for: what was read before sessions were
   * logged, and any correction or skim since. `read` is this plus every
   * session, which is why editing a session can move it.
   */
  base: number;
  phaseId?: string;
  edition?: string;
  language?: string;
  tags?: string[];
  /** Every change of status, oldest first. */
  statusLog?: StatusChange[];
  /** The day it was first opened. Kept through pauses. */
  startedDate?: string;
  pausedDate?: string;
  droppedDate?: string;
  dropReason?: string;
  /** Books meant to be read before this one. */
  after?: string[];
  /** A line about how to read it: "skim dated chapters", "finish". */
  note?: string;
  /** The last day it moved other than by a session: a correction or a skim. */
  touched?: string;
  /** The day a "no progress lately" nudge was waved off. */
  stallDismissed?: string;
};


/**
 * A book's spine colour. Books shelved before colours existed have none
 * stored, so one is derived from the id — arbitrary, but the same every time,
 * which is what matters for something you learn to recognise by sight.
 */
export function bookColor(b: Book): string {
  if (b.color) return b.color;
  let h = 2166136261;
  for (let i = 0; i < b.id.length; i++) {
    h ^= b.id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return BOOK_COLORS[h % BOOK_COLORS.length];
}

/** How far through a book, 0 to 1. A book with no length counts as unread. */
export function bookProgress(b: Book): number {
  if (!b.pages || b.pages <= 0) return 0;
  return Math.max(0, Math.min(1, b.read / b.pages));
}

export type CalorieEntry = {
  id: string;
  date: string;
  kcal: number;
  /** When it was logged. See Goal.doneAt. */
  at?: number;
  /** Which meal it belonged to. Absent on entries logged before tags. */
  tagId?: string;
};

/** Seeded the first time a device runs a build that has tags. */
export const DEFAULT_MEAL_TAGS: MealTag[] = [
  { id: "mt1", name: "Breakfast", color: "#b75014" },
  { id: "mt2", name: "Lunch", color: "#127c72" },
  { id: "mt3", name: "Dinner", color: "#8c4ed3" },
  { id: "mt4", name: "Snack", color: "#ca2f72" },
  { id: "mt5", name: "Coffee", color: "#97640c" },
];

/** Colour shown for entries with no tag, or whose tag has been deleted. */
export const UNTAGGED_COLOR = "#8b8e8c";

/** One exercise inside a workout, with the weight it's performed at. */
export type Exercise = {
  id: string;
  name: string;
  /** Working weight in kg. Left out for bodyweight movements. */
  weight?: number;
  /**
   * Done one arm or one leg at a time. The weight and reps recorded are for
   * the one side, so the exercise moves twice what its sets say and its volume
   * is doubled.
   *
   * A property of the movement rather than of a set, which is why it lives on
   * the definition: a one-arm row is always a one-arm row, and saying so once
   * beats saying it on every set of every session.
   */
  oneArm?: boolean;
  /**
   * How long it is held or worked, in seconds, for a movement measured in time
   * rather than in repetitions — a plank, a minute of jumping jacks. Where a
   * block sets its own work interval this overrides it, which is what lets a
   * warm-up give each movement its own length.
   */
  seconds?: number;
  /** A cue worth remembering while doing it. Shown while it is running. */
  note?: string;
  /**
   * The block it belongs to, or undefined for the workout's main body. The
   * exercise list stays flat and in order — blocks group it rather than own
   * it, so everything that reads a workout's exercises still reads them all.
   */
  blockId?: string;
};

/**
 * A named stretch of a workout, performed its own way.
 *
 * "sets" is the ordinary kind: exercises done for weight and repetitions, at
 * whatever pace. "circuit" is a timed round — every exercise for the same work
 * interval with the same rest between, repeated for a number of rounds, which
 * is how a warm-up or a conditioning block is actually done.
 */
export type WorkoutBlock = {
  id: string;
  name: string;
  mode: "sets" | "circuit";
  /** circuit: how many times through the list. */
  rounds?: number;
  /** circuit: seconds of work per exercise, unless the exercise sets its own. */
  workSeconds?: number;
  /** circuit: seconds of rest after each exercise. */
  restSeconds?: number;
};

/** The numbers that describe a single set. Shared by live and logged sets. */
export type SetRecord = {
  weight?: number;
  reps?: number;
  /**
   * Set-level one-arm marking, as it was recorded before the flag moved to the
   * exercise. Nothing writes it now, but sessions logged then still carry it
   * and are still counted by it, so their totals do not change.
   */
  oneArm?: boolean;
};

/**
 * One set inside a live workout. A set is planned first and performed second:
 * `done` is what separates the two, and only done sets count towards volume.
 */
export type ActiveSet = SetRecord & { id: string; done?: boolean };

export type ActiveExercise = {
  exerciseId: string;
  /** Copied from the definition. See Exercise.seconds, .note and .blockId. */
  seconds?: number;
  note?: string;
  blockId?: string;
  /** Copied from the definition at the start. See Exercise.oneArm. */
  oneArm?: boolean;
  /** Copied at start, so renaming or deleting mid-session can't break it. */
  name: string;
  /** The exercise's usual weight, used as the default for new sets. */
  weight?: number;
  sets: ActiveSet[];
  /**
   * Finished for this session. The sets stop being editable and are shown as
   * a plain record of what was lifted.
   */
  done?: boolean;
};

/** A workout in progress. At most one runs at a time. */
export type ActiveWorkout = {
  workoutId: string;
  name: string;
  startedAt: number;
  exercises: ActiveExercise[];
};

/**
 * Load moved by one set: weight × reps. Sets recorded before reps existed
 * count their weight once, so old sessions keep the total they were logged at.
 */
export function setLoad(set: SetRecord, oneArm = false): number {
  const reps = set.reps != null && set.reps > 0 ? set.reps : 1;
  // Doubled for one-arm work: the numbers describe one side of it. The set's
  // own flag is only ever set on sessions logged before the flag moved to the
  // exercise, and is honoured so their totals stay as they were recorded.
  const sides = oneArm || set.oneArm ? 2 : 1;
  return (set.weight ?? 0) * reps * sides;
}

/** Volume of a live workout. Only sets marked done count — planned ones don't. */
export function activeWorkoutVolume(a: ActiveWorkout): number {
  return a.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => (set.done ? s + setLoad(set, e.oneArm) : s), 0),
    0
  );
}

/** How many sets have actually been completed. */
export function activeWorkoutSets(a: ActiveWorkout): number {
  return a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

/** How many sets are on the board, done or not. */
export function activeWorkoutPlannedSets(a: ActiveWorkout): number {
  return a.exercises.reduce((n, e) => n + e.sets.length, 0);
}

/**
 * Rewrites one exercise's set list inside the live workout, leaving the rest of
 * the state alone. Every set mutation below is the same three levels of
 * spreading, so it lives here once rather than five times.
 */
export function editSets(
  s: TrackerState,
  exerciseId: string,
  fn: (sets: ActiveSet[]) => ActiveSet[]
): TrackerState {
  if (!s.activeWorkout) return s;
  return {
    ...s,
    activeWorkout: {
      ...s.activeWorkout,
      exercises: s.activeWorkout.exercises.map((e) =>
        e.exerciseId === exerciseId ? { ...e, sets: fn(e.sets) } : e
      ),
    },
  };
}

/** A weight or rep count, or undefined when the field was left empty. */
export function positiveNumber(v: number | null | undefined): number | undefined {
  return v != null && Number.isFinite(v) && v > 0 ? v : undefined;
}

/** A named workout — "Push day", "Legs" — holding an ordered exercise list. */
export type Workout = {
  id: string;
  name: string;
  exercises: Exercise[];
  /** Optional grouping. A workout with none is one unnamed block of sets. */
  blocks?: WorkoutBlock[];
};

/** The exercises of one block, in the workout's own order. */
export function blockExercises(w: Workout, blockId?: string): Exercise[] {
  return w.exercises.filter((e) => (e.blockId ?? undefined) === blockId);
}

/** How long one exercise runs in a circuit: its own time, or the block's. */
export function exerciseSeconds(e: Exercise, b?: WorkoutBlock): number {
  return e.seconds ?? b?.workSeconds ?? 40;
}

/**
 * A completed workout. The total is a snapshot of the summed exercise weights
 * at the moment it was marked done, so later weight changes don't rewrite past
 * sessions.
 */
export type WorkoutSession = {
  id: string;
  workoutId: string;
  /** Name at the time, kept so the history survives a rename or delete. */
  name: string;
  date: string;
  total: number;
  /** Sets performed. Absent on sessions logged before live tracking. */
  sets?: number;
  /** Elapsed time in whole minutes, from start to finish. */
  minutes?: number;
  /** When it was finished. See Goal.doneAt. */
  at?: number;
  /**
   * What was actually performed, exercise by exercise. Absent on sessions
   * logged before per-set detail was kept, which is why every reader of it
   * has to cope with it being missing.
   */
  exercises?: LoggedExercise[];
};

/** One exercise as performed in a finished session. */
export type LoggedExercise = {
  exerciseId: string;
  name: string;
  /** Whether it was done one side at a time. See Exercise.oneArm. */
  oneArm?: boolean;
  sets: SetRecord[];
};

/**
 * The last time an exercise was actually performed, with the numbers used.
 * Sessions are only ever appended, so the newest match is the last one found.
 */
export function lastPerformed(
  sessions: WorkoutSession[],
  exerciseId: string
): { date: string; sets: SetRecord[] } | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const e = sessions[i].exercises?.find((x) => x.exerciseId === exerciseId);
    if (e && e.sets.length > 0) return { date: sessions[i].date, sets: e.sets };
  }
  return null;
}

/** A protein / fibre log entry. Either field may be omitted. */
export type MacroEntry = {
  id: string;
  date: string;
  protein?: number;
  fiber?: number;
  /** When it was logged. See Goal.doneAt. */
  at?: number;
};

export type TrackerState = {
  categories: Category[];
  goals: Goal[];
  recurring: RecurringTask[];
  recurringGroups: RecurringGroup[];
  todos: TodoItem[];
  completions: Completion[];
  paths: Path[];
  /** Personal projects, each a board of cards. See lib/projects.ts. */
  projects: P.Project[];
  weights: WeightEntry[];
  cardio: CardioEntry[];
  books: Book[];
  readingTracks: ReadingTrack[];
  readingPhases: ReadingPhase[];
  readingSessions: ReadingSession[];
  bookQuotes: BookQuote[];
  calories: CalorieEntry[];
  mealTags: MealTag[];
  /** Daily calorie budget, used to work out what's left for the week. */
  calorieBudget?: number;
  macros: MacroEntry[];
  workouts: Workout[];
  workoutSessions: WorkoutSession[];
  /** The workout currently under way, if any. */
  activeWorkout?: ActiveWorkout | null;
  /** Daily protein target, in grams. */
  proteinTarget?: number;
  /** Daily fibre target, in grams. */
  fiberTarget?: number;
  /** Learning sessions: each +1 on a goal or one of its parts, with an optional note. */
  learningLog: LearningEntry[];
};

/** One learning session: a count moved on, on a day, perhaps with a line about it. */
export type LearningEntry = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** When, as epoch milliseconds, to keep a day's entries in order. */
  at: number;
  goalId: string;
  /** The part counted, when the goal has parts. */
  partId?: string;
  /** How much the count moved: 1 for a tap. */
  amount: number;
  /** At most 200 characters. */
  note?: string;
};

export const NOTE_MAX = 200;

/* The full chromatic range of the palette, plus its one usable neutral. */
/**
 * The colours a category, meal tag, reading track or book can be given.
 *
 * Eleven hues, ordered round the wheel, all at the same luminance: each
 * carries white text at 5.0:1 and still reads at 3.4:1 as a dot on the dark
 * card, so no colour is louder than its neighbours and every one works as a
 * dot, a chip and a spine alike. Mirrors --data-* in globals.css.
 *
 * Blue and cyan are left out on purpose: electric blue is the app's accent
 * and means progress, and a category that looked like it would muddy that.
 */
export const CAT_COLORS = [
  "#635fd9", // indigo
  "#8c4ed3", // violet
  "#b23bb2", // magenta
  "#ca2f72", // pink
  "#ce352a", // red
  "#b75014", // orange
  "#97640c", // amber
  "#64761c", // olive
  "#287d47", // green
  "#127c72", // teal
  "#646f7f", // slate
];

/**
 * The categories Google Books gives most, a colour each, so the common ones
 * never share one. Indexes into CAT_COLORS.
 */
const COMMON_CATEGORIES: Record<string, number> = {
  computers: 0, // indigo
  psychology: 1, // violet
  "biography & autobiography": 2, // magenta
  fiction: 3, // pink
  "health & fitness": 4, // red
  history: 5, // orange
  "business & economics": 6, // amber
  "technology & engineering": 7, // olive
  science: 8, // green
  "self-help": 9, // teal
  philosophy: 10, // slate
};

/**
 * The colour of a book's category ("Computers", "Self-Help"), which comes
 * from Google Books as a name rather than anything the reader set up. The
 * common ones have a colour each; any other is worked out from its name. So
 * the same category is the same colour on every book and every device, with
 * nothing to store.
 */
export function categoryColor(name: string): string {
  const key = name.trim().toLowerCase();
  const fixed = COMMON_CATEGORIES[key];
  if (fixed !== undefined) return CAT_COLORS[fixed];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CAT_COLORS[h % CAT_COLORS.length];
}

/**
 * The colours a spine can be: those from the palette that white text sits
 * legibly on.
 *
 * The title has to be one colour for the whole spine, because it runs across
 * both the read part and the grey part below it. Grey settles that — it needs
 * light text — so the fill has to take light text too, which rules out the
 * palette's paler half. Derived from CAT_COLORS rather than listed out, so a
 * colour added to the palette is considered here without being copied.
 */
export const BOOK_COLORS = CAT_COLORS.filter((c) => contrast("#ffffff", c) >= 4.5);


/** Picks a colour no existing category is already using. */
export function nextCategoryColor(existing: { color: string }[]): string {
  const used = new Set(existing.map((c) => c.color.toLowerCase()));
  const free = CAT_COLORS.find((c) => !used.has(c.toLowerCase()));
  if (free) return free;
  // Palette exhausted — cycle through it again rather than generating new hues,
  // so every category stays on the brand palette even when they repeat.
  return CAT_COLORS[existing.length % CAT_COLORS.length];
}

export const KEY = "momentum:v1";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "c1", name: "Work", color: "#635fd9" },
  { id: "c2", name: "Pressio", color: "#287d47" },
  { id: "c3", name: "Learning", color: "#8c4ed3" },
  { id: "c4", name: "Gym", color: "#ce352a" },
  { id: "c5", name: "Personal", color: "#127c72" },
];

/** Colours from every earlier theme → their current-palette replacements.
 *  Roles run Work / Pressio / Learning / Gym / Personal, era by era. Targets
 *  are retargeted whenever the palette changes, so a value saved under any
 *  past theme lands on a colour the palette still contains. */
export const LEGACY_CATEGORY_COLORS: Record<string, string> = {
  // HeroUI originals
  "#006fee": "#0f62fe", "#17c964": "#a7f0ba", "#7828c8": "#8a3ffc",
  "#f31260": "#ff8389", "#f5a524": "#33b1ff",
  // Atlassian era
  "#357de8": "#0f62fe", "#22a06b": "#a7f0ba", "#af59e1": "#8a3ffc",
  "#ae2e24": "#ff8389", "#c75300": "#33b1ff",
  // green-brand era
  "#2180e6": "#0f62fe", "#1ea97b": "#a7f0ba", "#264b04": "#8a3ffc",
  "#72c613": "#ff8389", "#c8efc1": "#33b1ff",
  // Neo Retro era
  "#a6a9be": "#0f62fe", "#1e3a1e": "#a7f0ba", "#0e0e0e": "#8a3ffc",
  "#e0761b": "#ff8389", "#b8c2c2": "#33b1ff",
  // Carbon era, before the palette was cut to thirteen colours
  "#009d9a": "#a7f0ba", "#ee5396": "#ff8389", "#1192e8": "#33b1ff",
  "#08bdba": "#33b1ff", "#ff7eb6": "#ff8389", "#ff832b": "#491d8b",
  "#24a148": "#a7f0ba", "#6929c4": "#491d8b", "#6f6f6f": "#a2a9b0",
  "#4589ff": "#0f62fe", "#42be65": "#a7f0ba", "#fa4d56": "#ff8389",
  "#a56eff": "#491d8b", "#da1e28": "#ff8389", "#f1c21b": "#a7f0ba",
  "#161616": "#121619", "#c6c6c6": "#a2a9b0", "#33b1ff": "#33b1ff",
};

/** Every earlier palette → today's. Each colour the app ever offered as a
 *  preset lands on the nearest hue still offered; blues and cyans go to
 *  indigo and teal, since blue now belongs to the accent. */
export const CARBON_TO_CURRENT: Record<string, string> = {
  // Carbon era
  "#0f62fe": "#635fd9", "#78a9ff": "#635fd9", "#0072c3": "#635fd9", "#33b1ff": "#127c72",
  "#08bdba": "#127c72", "#007d79": "#127c72", "#24a148": "#287d47", "#42be65": "#287d47",
  "#a7f0ba": "#287d47", "#f1c21b": "#97640c", "#ff832b": "#b75014", "#ba4e00": "#b75014",
  "#da1e28": "#ce352a", "#ff8389": "#ce352a", "#ee5396": "#ca2f72", "#9f1853": "#b23bb2",
  "#8a3ffc": "#8c4ed3", "#be95ff": "#8c4ed3", "#491d8b": "#635fd9", "#a2a9b0": "#646f7f",
  "#121619": "#646f7f",
  // later presets: the blue and the cyan
  "#2168e4": "#635fd9", "#11779d": "#127c72",
};

/**
 * Moves a colour saved under any earlier palette onto the current one.
 * A colour the reader chose outside every preset is left as it is.
 */
export function currentColor(color: string | undefined): string | undefined {
  if (!color) return color;
  const c = color.toLowerCase();
  const carbon = LEGACY_CATEGORY_COLORS[c] ?? c;
  return CARBON_TO_CURRENT[carbon] ?? color;
}

export const DEFAULT_TRACKS: ReadingTrack[] = [
  {
    id: "track-technical",
    name: "Technical",
    color: "#635fd9",
    wipLimit: 1,
    dailyTarget: 20,
    slot: "12:15 iPad block",
    restDays: 1,
  },
  {
    id: "track-nontechnical",
    name: "Non-technical",
    color: "#b75014",
    wipLimit: 1,
    dailyTarget: 30,
    slot: "Evening",
    restDays: 1,
  },
  {
    id: "track-slow",
    name: "Slow lane",
    color: "#8c4ed3",
    wipLimit: 1,
    dailyTarget: 10,
    slot: "Morning coffee",
    restDays: 1,
  },
];

export const DEFAULT_STATE: TrackerState = {
  categories: DEFAULT_CATEGORIES,
  goals: [],
  recurring: [],
  recurringGroups: [],
  todos: [],
  completions: [],
  paths: [],
  projects: [],
  weights: [],
  cardio: [],
  books: [],
  readingTracks: DEFAULT_TRACKS,
  readingPhases: [],
  readingSessions: [],
  bookQuotes: [],
  calories: [],
  mealTags: DEFAULT_MEAL_TAGS,
  macros: [],
  workouts: [],
  workoutSessions: [],
  activeWorkout: null,
  learningLog: [],
};

/** Monday-based start of the current week, as a YYYY-MM-DD key. */
export function weekStart(d: Date = new Date()): string {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dateKey(x);
}

/** Calories left in the current week: budget x 7 minus everything logged. */
export function caloriesLeftThisWeek(
  calories: CalorieEntry[],
  budget?: number
): number | null {
  if (!budget || budget <= 0) return null;
  const from = weekStart();
  const logged = calories
    .filter((e) => e.date >= from && e.date <= dateKey())
    .reduce((a, e) => a + e.kcal, 0);
  return budget * 7 - logged;
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function dateKey(d: Date = new Date()): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function daysSinceEpoch(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function periodKey(freq: Frequency, key: string): string {
  switch (freq) {
    case "daily":
      return key;
    case "weekly":
      return "w" + Math.floor(daysSinceEpoch(key) / 7);
    case "biweekly":
      return "b" + Math.floor(daysSinceEpoch(key) / 14);
    case "monthly":
      return key.slice(0, 7);
  }
}

export function isRecurringDone(r: RecurringTask, today: string = dateKey()): boolean {
  return !!r.lastDone && periodKey(r.freq, r.lastDone) === periodKey(r.freq, today);
}

/**
 * Counting units for stats: an ungrouped task counts once, and a whole group
 * counts once (doing any member covers the group).
 */
export function recurringUnits(
  recurring: RecurringTask[],
  today: string = dateKey()
): { key: string; done: boolean }[] {
  const seen = new Set<string>();
  const units: { key: string; done: boolean }[] = [];
  for (const r of recurring) {
    const key = r.groupId ?? r.id;
    if (seen.has(key)) continue;
    seen.add(key);
    units.push({ key, done: isRecurringDone(r, today) });
  }
  return units;
}

/** True when there is a percentage to show: the goal has a count or parts. */
export function goalHasProgress(g: Goal): boolean {
  return !!g.parts?.length || (typeof g.target === "number" && g.target > 0);
}

/** A part's percentage, 0–100. */
export function partPct(p: Part): number {
  if (!p.target || p.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((p.current / p.target) * 100)));
}

/** True once some of the goal is done: its count, or any of its parts. */
export function goalStarted(g: Goal): boolean {
  if (g.done) return true;
  if (g.parts?.length) return g.parts.some((p) => p.current > 0);
  return (g.current ?? 0) > 0;
}

/**
 * A goal's status. One saved before statuses existed is done if ticked,
 * active if some of it is counted, and queued otherwise; and where an older
 * copy of the app ticked or unticked a goal without touching its status, the
 * tick wins.
 */
export function goalStatus(g: Goal): GoalStatus {
  if (g.status === "dropped") return "dropped";
  if (g.done) return "done";
  if (g.status && g.status !== "done") return g.status;
  return goalStarted(g) ? "active" : "queued";
}

/**
 * Whether every count that has a minimum has reached it: true or false, or
 * null when none has one (nothing to say).
 */
export function minimumReached(g: Goal): boolean | null {
  const counts = g.parts?.length
    ? g.parts.map((p) => ({ current: p.current, minimum: p.minimum }))
    : [{ current: g.current ?? 0, minimum: g.minimum }];
  const withMin = counts.filter((c) => c.minimum != null);
  if (!withMin.length) return null;
  return withMin.every((c) => c.current >= c.minimum!);
}

/** Status order in a topic: active, then queued, then done, then dropped. */
export const STATUS_RANK: Record<GoalStatus, number> = { active: 0, queued: 1, done: 2, dropped: 3 };

/**
 * "2 of 5 done", or, while nothing is finished, "1 of 5 started", so the
 * words never read 0 beside a ring that has moved; "5 parts" before any start.
 */
export function countLine(total: number, done: number, started: number, noun: string): string {
  if (done > 0) return `${done} of ${total} done`;
  if (started > 0) return `${started} of ${total} started`;
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
}

/** A goal with steps, in words: see countLine. */
export function stepsLine(steps: Goal[]): string {
  return countLine(steps.length, steps.filter((g) => g.done).length, steps.filter(goalStarted).length, "goal");
}

/** How far a goal is, in words: "2 of 4 parts done", "3 of 12", or null. */
export function goalSummary(g: Goal): string | null {
  if (g.parts?.length) {
    return countLine(
      g.parts.length,
      g.parts.filter((p) => p.current >= p.target).length,
      g.parts.filter((p) => p.current > 0).length,
      "part"
    );
  }
  if (g.target) return `${(g.current ?? 0).toLocaleString()} of ${g.target.toLocaleString()}`;
  return null;
}

/**
 * A goal's percentage: its count over its total. A goal without a count has
 * no percentage; it is simply done or not.
 *
 * Floored, so the figure never claims more progress than has actually happened
 * and only reaches 100% when everything really is finished.
 */
export function goalPct(g: Goal): number {
  // Each part weighs the same, so thirty readings don't drown out one project.
  if (g.parts?.length) return Math.floor(g.parts.reduce((sum, p) => sum + partPct(p), 0) / g.parts.length);
  if (!g.target || g.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor(((g.current ?? 0) / g.target) * 100)));
}

/**
 * Goals used to be broken into steps. Saved ones become the goal's count, so
 * a goal with 1 of 4 steps done reads "1 of 4"; a goal that already had a
 * count of its own keeps it.
 */
export function stepsAsCount(raw: unknown): { current: number; target: number } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const steps = raw as Array<Record<string, unknown>>;
  const done = steps.filter((t) =>
    typeof t.target === "number" && t.target > 0
      ? (typeof t.current === "number" ? t.current : 0) >= t.target
      : t.done === true
  ).length;
  return { current: done, target: steps.length };
}

/** The topic a goal is shown under: the first that holds it, if any. */
export function goalTopic(goalId: string, paths: Path[]): Path | undefined {
  return paths.find((p) => p.goalIds.includes(goalId));
}

/** The goals on a path, in the path's order, skipping any since deleted. */
export function pathGoals(p: Path, goals: Goal[]): Goal[] {
  return p.goalIds
    .map((id) => goals.find((g) => g.id === id))
    .filter((g): g is Goal => !!g);
}

/**
 * A path's percentage: the mean of its goals' own percentages.
 *
 * Each goal counts once whatever its count, so a goal of 600 pages does not
 * drown out one of 4 modules — on a path, a goal
 * is a step, and steps are equal. A goal marked done counts as complete even
 * if it carries no figures, because ticking it is the whole way some goals are
 * finished.
 */
export function pathPct(p: Path, goals: Goal[]): number {
  const list = pathGoals(p, goals);
  if (list.length === 0) return 0;
  const total = list.reduce((sum, g) => sum + (g.done ? 100 : goalPct(g)), 0);
  return Math.max(0, Math.min(100, Math.floor(total / list.length)));
}

/** A real calendar date as YYYY-MM-DD. */
export function isDateKey(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** "in 23 days", "today" or "5 days ago", from today to a YYYY-MM-DD date. */
export function countdown(date: string, today: string = dateKey()): string {
  const utc = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const n = Math.round((utc(date) - utc(today)) / 86_400_000);
  if (n === 0) return "today";
  const days = `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"}`;
  return n > 0 ? `in ${days}` : `${days} ago`;
}

/** A minimum is a number from 0 up to the target. */
export function validMinimum(m: unknown, target: number | undefined): m is number {
  return typeof m === "number" && Number.isFinite(m) && m > 0 && (!target || m <= target);
}

function migrateParts(raw: unknown): Part[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const parts = (raw as Array<Record<string, unknown>>)
    .filter((p) => typeof p.title === "string" && p.title.trim() && typeof p.target === "number" && p.target > 0)
    .map((p) => ({
      id: (p.id as string) ?? uid(),
      title: (p.title as string).trim(),
      target: p.target as number,
      current: Math.min(p.target as number, Math.max(0, typeof p.current === "number" ? p.current : 0)),
      ...(validMinimum(p.minimum, p.target as number) ? { minimum: p.minimum as number } : {}),
    }));
  return parts.length ? parts : undefined;
}

export function migrate(raw: unknown): TrackerState {
  const s = (raw ?? {}) as Record<string, unknown>;
  const categories = Array.isArray(s.categories)
    ? (s.categories as Category[]).map((c) => ({
        ...c,
        // Colours saved under an earlier palette are moved onto this one;
        // anything the user picked themselves is left untouched.
        color: currentColor(c.color) ?? c.color,
      }))
    : DEFAULT_CATEGORIES;

  const recurring: RecurringTask[] = Array.isArray(s.recurring)
    ? (s.recurring as Array<Record<string, unknown>>).map((r) => ({
        id: (r.id as string) ?? uid(),
        title: r.title as string,
        catId: r.catId as string,
        freq: (r.freq as Frequency) ?? "daily",
        lastDone: (r.lastDone as string) ?? null,
        groupId: (r.groupId as string) ?? undefined,
      }))
    : [];

  const recurringGroups: RecurringGroup[] = Array.isArray(s.recurringGroups)
    ? (s.recurringGroups as RecurringGroup[])
    : [];

  // Goals come from `goals`, or the older `board`/`tasks` shapes.
  const rawGoals: Array<Record<string, unknown>> = Array.isArray(s.goals)
    ? (s.goals as Array<Record<string, unknown>>)
    : Array.isArray(s.board)
    ? (s.board as Array<Record<string, unknown>>)
    : Array.isArray(s.tasks)
    ? (s.tasks as Array<Record<string, unknown>>)
    : [];
  const goals: Goal[] = rawGoals.map((g) => ({
    id: (g.id as string) ?? uid(),
    title: g.title as string,
    catId: g.catId as string,
    ...(typeof g.target === "number" && g.target > 0
      ? { current: typeof g.current === "number" ? g.current : undefined, target: g.target }
      : stepsAsCount(g.subtasks) ?? {
          current: typeof g.current === "number" ? g.current : undefined,
          target: undefined,
        }),
    done: typeof g.done === "boolean" ? g.done : g.status === "done",
    doneDate: (g.doneDate as string) ?? null,
    doneAt: typeof g.doneAt === "number" ? g.doneAt : null,
    pinned: g.pinned === true ? true : undefined,
    link: typeof g.link === "string" && g.link.trim() ? g.link.trim() : undefined,
    note: typeof g.note === "string" && g.note.trim() ? g.note.trim() : undefined,
    parts: migrateParts(g.parts),
    targetDate: isDateKey(g.targetDate) ? g.targetDate : undefined,
    minimum: validMinimum(g.minimum, typeof g.target === "number" ? g.target : undefined) ? (g.minimum as number) : undefined,
    phaseIds: Array.isArray(g.phaseIds)
      ? [...new Set((g.phaseIds as unknown[]).filter((x): x is string => typeof x === "string"))].slice(0, 2)
      : undefined,
  })).map((g, i) => {
    const raw = rawGoals[i].status;
    const status = typeof raw === "string" && (GOAL_STATUSES as string[]).includes(raw) ? (raw as GoalStatus) : undefined;
    return { ...g, status: goalStatus({ ...g, status }) };
  });

  const todos: TodoItem[] = Array.isArray(s.todos)
    ? (s.todos as Array<Record<string, unknown>>).map((t) => ({
        id: (t.id as string) ?? uid(),
        title: t.title as string,
        done: !!t.done,
        doneDate: (t.doneDate as string) ?? null,
        doneAt: typeof t.doneAt === "number" ? t.doneAt : null,
      }))
    : [];

  const completions: Completion[] = Array.isArray(s.completions)
    ? (s.completions as Completion[])
    : [];

  const weights: WeightEntry[] = Array.isArray(s.weights)
    ? (s.weights as WeightEntry[])
    : [];

  // Added after cardio tracking existed only as workout minutes, so older
  // saved state has no key at all.
  const cardio: CardioEntry[] = Array.isArray(s.cardio) ? (s.cardio as CardioEntry[]) : [];

  // Added after the rest, so older saved state has no key at all.
  const paths: Path[] = Array.isArray(s.paths)
    ? (s.paths as Array<Record<string, unknown>>).map((x) => ({
        id: (x.id as string) ?? uid(),
        title: (x.title as string) ?? "",
        note: (x.note as string) || undefined,
        catId: (x.catId as string) || undefined,
        goalIds: Array.isArray(x.goalIds) ? (x.goalIds as string[]).filter((g) => typeof g === "string") : [],
      }))
    : [];

  // Added after the rest, so older saved state has no key at all.
  const reading = R.migrateReading(s, Array.isArray(s.books) ? (s.books as Book[]) : []);

  const calories: CalorieEntry[] = Array.isArray(s.calories)
    ? (s.calories as CalorieEntry[])
    : [];

  // Absent means this state predates tags, so seed the defaults. An empty
  // array means the reader deleted them all, which we leave alone.
  const mealTags: MealTag[] = Array.isArray(s.mealTags)
    ? (s.mealTags as MealTag[]).map((t) => ({ ...t, color: currentColor(t.color) ?? t.color }))
    : DEFAULT_MEAL_TAGS;

  // Added after the first release, so older saved state has no macros key.
  const macros: MacroEntry[] = Array.isArray(s.macros) ? (s.macros as MacroEntry[]) : [];

  const workoutSessions: WorkoutSession[] = Array.isArray(s.workoutSessions)
    ? (s.workoutSessions as WorkoutSession[])
    : [];

  const activeWorkout =
    s.activeWorkout && typeof s.activeWorkout === "object"
      ? (s.activeWorkout as ActiveWorkout)
      : null;

  const workouts: Workout[] = Array.isArray(s.workouts)
    ? (s.workouts as Workout[]).map((w) => ({
        ...w,
        exercises: Array.isArray(w.exercises) ? w.exercises : [],
      }))
    : [];

  const positive = (v: unknown) => {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return {
    // Anything this build doesn't recognise is carried through untouched.
    // Without this, a device running an older bundle would parse a document
    // containing newer fields, drop them, and then write the pruned state back
    // — silently deleting that data for every other device.
    ...(s as Partial<TrackerState>),
    categories,
    ...topicCategories(paths, goals),
    recurring,
    recurringGroups,
    todos,
    completions,
    projects: P.migrateProjects(s.projects, uid),
    weights,
    cardio,
    ...reading,
    calories,
    mealTags,
    calorieBudget:
      typeof s.calorieBudget === "number" && s.calorieBudget > 0 ? s.calorieBudget : undefined,
    macros,
    workouts,
    workoutSessions,
    activeWorkout,
    proteinTarget: positive(s.proteinTarget),
    fiberTarget: positive(s.fiberTarget),
    learningLog: Array.isArray(s.learningLog)
      ? (s.learningLog as Array<Record<string, unknown>>)
          .filter((e) => typeof e.goalId === "string" && typeof e.date === "string" && typeof e.amount === "number")
          .map((e) => ({
            id: (e.id as string) ?? uid(),
            date: e.date as string,
            at: typeof e.at === "number" ? e.at : 0,
            goalId: e.goalId as string,
            ...(typeof e.partId === "string" ? { partId: e.partId } : {}),
            amount: e.amount as number,
            ...(typeof e.note === "string" && e.note.trim() ? { note: e.note.trim().slice(0, NOTE_MAX) } : {}),
          }))
      : [],
  };
}

/**
 * Resolves after the next frame has been painted — or after 100 ms, for a
 * page in the background, where frames aren't drawn.
 */
export function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(go, 0));
    setTimeout(go, 100);
  });
}

/** The goals named, given the topic's category (when it has one). */
export function withTopicCategory(goals: Goal[], topic: Path | undefined, ids: string[]): Goal[] {
  if (!topic?.catId) return goals;
  const set = new Set(ids);
  return goals.map((g) => (set.has(g.id) && g.catId !== topic.catId ? { ...g, catId: topic.catId! } : g));
}

/**
 * Category moved from goals to topics: a topic without one takes the one
 * most of its goals share, and a goal in a topic takes its topic's. A goal
 * belongs to the first topic that holds it, as everywhere else.
 */
export function topicCategories(paths: Path[], goals: Goal[]): { paths: Path[]; goals: Goal[] } {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const outPaths = paths.map((p) => {
    if (p.catId) return p;
    const counts = new Map<string, number>();
    for (const id of p.goalIds) {
      const c = byId.get(id)?.catId;
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return top ? { ...p, catId: top } : p;
  });
  const topicOf = new Map<string, Path>();
  for (const p of outPaths) for (const id of p.goalIds) if (!topicOf.has(id)) topicOf.set(id, p);
  const outGoals = goals.map((g) => {
    const c = topicOf.get(g.id)?.catId;
    return c && g.catId !== c ? { ...g, catId: c } : g;
  });
  return { paths: outPaths, goals: outGoals };
}

/** Strips `undefined` values — Firestore rejects them outright. */
export function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function friendlyAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/missing-password":
      return "Enter a password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/email-already-in-use":
      return "An account with that email already exists — sign in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/unauthorized-domain":
      return "This site's domain isn't authorized in Firebase. Add it under Authentication → Settings → Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    default:
      return "Something went wrong. Please try again.";
  }
}


/** Minutes trained per date, summing every session logged that day. */
export function workoutMinutesByDate(sessions: WorkoutSession[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of sessions) if (s.minutes) map[s.date] = (map[s.date] ?? 0) + s.minutes;
  return map;
}

/** Cardio minutes per date, summing every effort logged that day. */
export function cardioMinutesByDate(entries: CardioEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of entries) if (c.minutes) map[c.date] = (map[c.date] ?? 0) + c.minutes;
  return map;
}

/** Total lifted weight per date, summing every session logged that day. */
export function workoutVolumeByDate(sessions: WorkoutSession[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of sessions) map[s.date] = (map[s.date] ?? 0) + s.total;
  return map;
}

/** Totals protein and fibre per date, for the combined chart. */
export function macroTotalsByDate(
  macros: MacroEntry[]
): Record<string, { protein: number; fiber: number }> {
  const map: Record<string, { protein: number; fiber: number }> = {};
  for (const m of macros) {
    const day = (map[m.date] ??= { protein: 0, fiber: 0 });
    day.protein += m.protein ?? 0;
    day.fiber += m.fiber ?? 0;
  }
  return map;
}

export function completionsByDate(completions: Completion[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of completions) map[c.date] = (map[c.date] ?? 0) + 1;
  return map;
}

export function catCompletionsByDate(completions: Completion[], catId: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of completions) if (c.catId === catId) map[c.date] = (map[c.date] ?? 0) + 1;
  return map;
}

export function streak(completions: Completion[]): number {
  const map = completionsByDate(completions);
  let s = 0;
  const d = new Date();
  if (!map[dateKey(d)]) d.setDate(d.getDate() - 1);
  for (;;) {
    const k = dateKey(d);
    if (map[k]) {
      s++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return s;
}
