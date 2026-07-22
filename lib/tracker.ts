"use client";

import { useEffect, useRef, useState } from "react";

export type Category = { id: string; name: string; color: string };
export type Task = {
  id: string;
  title: string;
  catId: string;
  date: string;
  done: boolean;
  doneDate: string | null;
};
export type BoardStatus = "planned" | "progress" | "done";
export type BoardCard = { id: string; title: string; catId: string; status: BoardStatus };

export type TrackerState = {
  categories: Category[];
  tasks: Task[];
  board: BoardCard[];
};

export const CAT_COLORS = [
  "#F5A524", "#17C964", "#006FEE", "#7828C8",
  "#F31260", "#66AAF9", "#F97316", "#0EA5E9",
];

const KEY = "momentum:v1";

const DEFAULT_STATE: TrackerState = {
  categories: [
    { id: "c1", name: "Work", color: "#006FEE" },
    { id: "c2", name: "Pressio", color: "#17C964" },
    { id: "c3", name: "Learning", color: "#7828C8" },
    { id: "c4", name: "Gym", color: "#F31260" },
    { id: "c5", name: "Personal", color: "#F5A524" },
  ],
  tasks: [],
  board: [],
};

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

export function useTracker() {
  const [state, setState] = useState<TrackerState | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setState(raw ? (JSON.parse(raw) as TrackerState) : DEFAULT_STATE);
    } catch {
      setState(DEFAULT_STATE);
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current && state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        console.error("Could not save", e);
      }
    }
  }, [state]);

  const update = (fn: (s: TrackerState) => TrackerState) =>
    setState((s) => (s ? fn(s) : s));

  return {
    state,
    cat: (id: string): Category =>
      state?.categories.find((c) => c.id === id) ?? {
        id: "",
        name: "–",
        color: "#8A94A3",
      },

    addTask: (title: string, catId: string) =>
      update((s) => ({
        ...s,
        tasks: [
          ...s.tasks,
          { id: uid(), title, catId, date: dateKey(), done: false, doneDate: null },
        ],
      })),

    toggleTask: (id: string) =>
      update((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id
            ? { ...t, done: !t.done, doneDate: !t.done ? dateKey() : null }
            : t
        ),
      })),

    deleteTask: (id: string) =>
      update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),

    moveTaskToToday: (id: string) =>
      update((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, date: dateKey() } : t)),
      })),

    addCategory: (name: string) =>
      update((s) => ({
        ...s,
        categories: [
          ...s.categories,
          { id: uid(), name, color: CAT_COLORS[s.categories.length % CAT_COLORS.length] },
        ],
      })),

    deleteCategory: (id: string): boolean => {
      if (
        state?.tasks.some((t) => t.catId === id) ||
        state?.board.some((b) => b.catId === id)
      )
        return false;
      update((s) => ({
        ...s,
        categories: s.categories.filter((c) => c.id !== id),
      }));
      return true;
    },

    addCard: (title: string, status: BoardStatus) =>
      update((s) => ({
        ...s,
        board: [
          ...s.board,
          { id: uid(), title, catId: s.categories[0]?.id ?? "", status },
        ],
      })),

    moveCard: (id: string, dir: -1 | 1) =>
      update((s) => {
        const order: BoardStatus[] = ["planned", "progress", "done"];
        return {
          ...s,
          board: s.board.map((b) => {
            if (b.id !== id) return b;
            const i = order.indexOf(b.status) + dir;
            return i < 0 || i > 2 ? b : { ...b, status: order[i] };
          }),
        };
      }),

    cycleCardCat: (id: string) =>
      update((s) => ({
        ...s,
        board: s.board.map((b) => {
          if (b.id !== id) return b;
          const i = s.categories.findIndex((c) => c.id === b.catId);
          const next = s.categories[(i + 1) % s.categories.length];
          return { ...b, catId: next?.id ?? b.catId };
        }),
      })),

    deleteCard: (id: string) =>
      update((s) => ({ ...s, board: s.board.filter((b) => b.id !== id) })),
  };
}

export type Tracker = ReturnType<typeof useTracker>;

export function completionsByDate(tasks: Task[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of tasks)
    if (t.done && t.doneDate) map[t.doneDate] = (map[t.doneDate] ?? 0) + 1;
  return map;
}

export function streak(tasks: Task[]): number {
  const map = completionsByDate(tasks);
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
