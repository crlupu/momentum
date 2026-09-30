/**
 * Learning goals from a file: JSON or Markdown, the two shapes an AI writes
 * most readily, read into topics and their goals.
 *
 * JSON — one topic, several, or just goals:
 *
 *   { "topic": "Rust ramp up", "category": "Learning",
 *     "description": "Enough Rust to rewrite the consumer",
 *     "goals": [ { "title": "The Rust Book, ch. 1–10", "description": "…",
 *                  "link": "https://…", "count": 10, "done": 0 } ] }
 *
 *   { "topics": [ { "topic": "…", "goals": [ … ] }, … ] }
 *   [ { "title": "…" }, … ]                      goals only
 *
 * Markdown:
 *
 *   # Rust ramp up                               a topic
 *   Category: Learning                           its category (optional)
 *   Enough Rust to rewrite the consumer          its description
 *   - [The Rust Book](https://…) (10)            a goal: link, count of 10
 *     Chapters on ownership and traits           its description, indented
 *   - [x] Rustlings (3/94)                       done 3 of 94; [x] = done
 *
 * Importing is repeatable: topics are matched by name and goals by title
 * within their topic, so importing an edited file again updates what is
 * there instead of adding it twice. A goal's progress is only changed when
 * the file gives one.
 */

import { dateKey, uid, type Goal, type Path, type TrackerState } from "./tracker";

export type PlanGoal = {
  title: string;
  description?: string;
  link?: string;
  /** How far along, of `target`. */
  current?: number;
  target?: number;
  done?: boolean;
};

export type PlanTopic = {
  /** Absent for goals given without a topic. */
  name?: string;
  category?: string;
  description?: string;
  goals: PlanGoal[];
};

export type GoalPlan = {
  topics: PlanTopic[];
  /** Why nothing could be read, when nothing could. */
  error?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const numOf = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

export function parseGoalPlan(text: string): GoalPlan {
  const t = text.trim();
  if (!t) return { topics: [] };
  // Fenced code, as AI chats tend to wrap their answers.
  const fenced = t.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  const body = fenced ? fenced[1].trim() : t;
  if (body.startsWith("{") || body.startsWith("[")) return parseJson(body);
  return parseMarkdown(body);
}

/* -------------------------------- JSON --------------------------------- */

function jsonGoal(v: unknown): PlanGoal | null {
  if (typeof v === "string") return v.trim() ? { title: v.trim() } : null;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const title = str(o.title) ?? str(o.name) ?? str(o.goal);
  if (!title) return null;
  const target = numOf(o.count) ?? numOf(o.total) ?? numOf(o.target);
  const doneFlag = o.done === true || o.completed === true;
  const current = typeof o.done === "number" ? numOf(o.done) : numOf(o.current) ?? numOf(o.progress);
  return {
    title,
    description: str(o.description) ?? str(o.details) ?? str(o.note) ?? str(o.notes),
    link: str(o.link) ?? str(o.url),
    ...(target ? { target } : {}),
    ...(current != null ? { current } : {}),
    ...(doneFlag ? { done: true } : {}),
  };
}

function jsonTopic(v: unknown): PlanTopic | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const list = Array.isArray(o.goals) ? o.goals : Array.isArray(o.items) ? o.items : null;
  if (!list) return null;
  return {
    name: str(o.topic) ?? str(o.name) ?? str(o.title),
    category: str(o.category),
    description: str(o.description) ?? str(o.note),
    goals: list.map(jsonGoal).filter((g): g is PlanGoal => !!g),
  };
}

function parseJson(body: string): GoalPlan {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return { topics: [], error: `That isn't valid JSON: ${(e as Error).message}` };
  }
  const topics: PlanTopic[] = [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(data)) {
    // A list of topics, or a list of goals.
    const asTopics = data.map(jsonTopic);
    if (data.length > 0 && asTopics.every(Boolean)) topics.push(...(asTopics as PlanTopic[]));
    else topics.push({ goals: data.map(jsonGoal).filter((g): g is PlanGoal => !!g) });
  } else if (data && typeof data === "object" && Array.isArray(obj.topics)) {
    topics.push(...(obj.topics.map(jsonTopic).filter(Boolean) as PlanTopic[]));
  } else {
    const one = jsonTopic(data);
    if (one) topics.push(one);
  }
  const found = topics.filter((x) => x.goals.length > 0);
  return found.length
    ? { topics: found }
    : { topics: [], error: "No goals found. Give them as a \"goals\" list of objects with a \"title\"." };
}

/* ------------------------------ Markdown ------------------------------- */

const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

/** A goal from a list item: checkbox, link, and a count at the end. */
function mdGoal(raw: string): PlanGoal | null {
  let s = raw.trim();
  let done = false;
  const box = s.match(/^\[( |x|X)\]\s*(.*)$/);
  if (box) {
    done = box[1].toLowerCase() === "x";
    s = box[2];
  }
  let current: number | undefined;
  let target: number | undefined;
  const count = s.match(/\s*[([]\s*(?:(\d+)\s*(?:\/|of)\s*)?(\d+)(?:\s+[a-z]+)?\s*[)\]]\s*$/i);
  if (count) {
    target = Number(count[2]) || undefined;
    current = count[1] != null ? Number(count[1]) : undefined;
    s = s.slice(0, count.index).trim();
  }
  let link: string | undefined;
  const md = s.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/);
  if (md) {
    link = md[2];
    s = s.replace(md[0], md[1]);
  }
  // "Title — details" puts the details in the description; a plain hyphen or
  // colon is left alone, since titles have those ("1Z0-830: Java SE 21").
  let description: string | undefined;
  const dash = s.match(/^(.*?)\s+(?:—|--)\s+(.+)$/);
  if (dash) {
    s = dash[1];
    description = dash[2].trim();
  }
  const title = s.replace(/\*\*|__|`/g, "").trim();
  if (!title) return null;
  return {
    title,
    ...(description ? { description } : {}),
    ...(link ? { link } : {}),
    ...(target ? { target } : {}),
    ...(current != null ? { current } : {}),
    ...(done ? { done: true } : {}),
  };
}

function parseMarkdown(body: string): GoalPlan {
  const topics: PlanTopic[] = [];
  let topic: PlanTopic | null = null;
  let goal: PlanGoal | null = null;
  let goalIndent = 0;
  const topicText: string[] = [];

  const openTopic = (name?: string) => {
    if (topic) finishTopic();
    topic = { name, goals: [] };
    topicText.length = 0;
    goal = null;
  };
  const finishTopic = () => {
    if (!topic) return;
    const d = topicText.join(" ").trim();
    if (d && !topic.description) topic.description = d;
    topics.push(topic);
  };

  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const h = line.match(HEADING);
    if (h) {
      openTopic(h[1].replace(/\*\*|__/g, "").trim());
      continue;
    }
    const b = line.match(BULLET);
    const indent = (line.match(/^\s*/)?.[0].length ?? 0);
    if (b && (!goal || indent <= goalIndent)) {
      if (!topic) openTopic();
      goal = mdGoal(b[2]);
      goalIndent = indent;
      if (goal) topic!.goals.push(goal);
      continue;
    }
    // Indented under a goal, or a sub-bullet: that goal's description.
    if (goal && (indent > goalIndent || b)) {
      const text = (b ? b[2] : line).trim();
      const g = goal as PlanGoal;
      g.description = g.description ? `${g.description}\n${text}` : text;
      continue;
    }
    if (!topic) openTopic();
    const cat = line.match(/^\s*\**category\**\s*:\s*\**\s*(.+?)\s*\**$/i);
    if (cat && !goal) {
      topic!.category = cat[1];
      continue;
    }
    if (!goal) topicText.push(line.trim());
  }
  finishTopic();
  const found = topics.filter((x) => x.goals.length > 0);
  return found.length
    ? { topics: found }
    : { topics: [], error: "No goals found. List them as \"- Goal\" lines, under \"# Topic\" headings." };
}

/* -------------------------------- Apply -------------------------------- */

export type ImportOptions = {
  /**
   * Where the goals go: "file" keeps the file's topics (goals without one go
   * to no topic), a topic id puts every goal there, null puts them in none.
   */
  into: "file" | string | null;
  /** The category for new topics the file names none for, or can't match. */
  fallbackCatId: string;
};

export type ImportPreview = {
  topicsNew: string[];
  topicsMatched: string[];
  goalsNew: number;
  goalsUpdated: number;
};

export function applyGoalPlan(
  s: TrackerState,
  plan: GoalPlan,
  opts: ImportOptions
): { state: TrackerState; preview: ImportPreview } {
  const preview: ImportPreview = { topicsNew: [], topicsMatched: [], goalsNew: 0, goalsUpdated: 0 };
  let goals = [...s.goals];
  let paths = [...s.paths];
  const catByName = new Map(s.categories.map((c) => [norm(c.name), c.id]));

  const findTopic = (name: string) => paths.find((p) => norm(p.title) === norm(name));

  for (const t of plan.topics) {
    // The topic these goals land in.
    let path: Path | undefined;
    if (opts.into === "file") {
      if (t.name) {
        path = findTopic(t.name);
        if (path) {
          if (!preview.topicsMatched.includes(path.title)) preview.topicsMatched.push(path.title);
        } else {
          path = {
            id: uid(),
            title: t.name,
            catId: (t.category && catByName.get(norm(t.category))) || opts.fallbackCatId,
            ...(t.description ? { note: t.description } : {}),
            goalIds: [],
          };
          paths = [...paths, path];
          preview.topicsNew.push(path.title);
        }
      }
    } else if (opts.into) {
      path = paths.find((p) => p.id === opts.into);
    }

    const catId =
      path?.catId || (t.category && catByName.get(norm(t.category))) || opts.fallbackCatId;
    const inPath = new Set(path?.goalIds ?? []);

    for (const pg of t.goals) {
      // Matched by title among the topic's goals, or among goals in no topic.
      const existing = goals.find(
        (g) =>
          norm(g.title) === norm(pg.title) &&
          (path ? inPath.has(g.id) : !paths.some((p) => p.goalIds.includes(g.id)))
      );
      if (existing) {
        goals = goals.map((g) =>
          g.id === existing.id
            ? {
                ...g,
                ...(pg.description ? { note: pg.description } : {}),
                ...(pg.link ? { link: pg.link } : {}),
                ...(pg.target ? { target: pg.target } : {}),
                ...(pg.current != null ? { current: pg.current } : {}),
              }
            : g
        );
        preview.goalsUpdated++;
        continue;
      }
      const goal: Goal = {
        id: uid(),
        title: pg.title,
        catId,
        done: !!pg.done,
        doneDate: pg.done ? dateKey() : null,
        ...(pg.target ? { target: pg.target, current: Math.min(pg.current ?? 0, pg.target) } : {}),
        ...(pg.description ? { note: pg.description } : {}),
        ...(pg.link ? { link: pg.link } : {}),
      };
      goals = [...goals, goal];
      if (path) {
        const id = path.id;
        paths = paths.map((p) => (p.id === id ? { ...p, goalIds: [...p.goalIds, goal.id] } : p));
        path = paths.find((p) => p.id === id);
      }
      preview.goalsNew++;
    }
  }

  return { state: { ...s, goals, paths }, preview };
}

/** The JSON format as a worked example, shown in the import dialog to copy. */
export const GOAL_JSON_FORMAT = `{
  "topic": "Rust ramp up",
  "category": "Learning",
  "description": "Enough Rust to rewrite the fixtures consumer",
  "goals": [
    {
      "title": "The Rust Book",
      "description": "Chapters 1–20, with the exercises",
      "link": "https://doc.rust-lang.org/book/",
      "count": 20
    },
    { "title": "Rustlings", "count": 94, "done": 3 },
    { "title": "Rewrite the fixtures consumer in Rust" }
  ]
}`;
