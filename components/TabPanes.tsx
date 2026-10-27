"use client";

import { ComponentType, createContext, memo, ReactNode, useContext, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TodayPage from "@/app/page";
import EducationPage from "@/app/education/page";
import ProjectsPage from "@/app/projects/page";
import FitnessPage from "@/app/fitness/page";
import { ShellContext } from "./AppShell";

/** The four tabs' pages, by path: kept mounted so switching tabs is instant. */
function panes(): Record<string, ComponentType> {
  return { "/": TodayPage, "/education": EducationPage, "/projects": ProjectsPage, "/fitness": FitnessPage };
}

export function isPane(path: string): boolean {
  return path in panes();
}

const PaneParams = createContext<URLSearchParams | null>(null);
const PaneVisible = createContext(true);

/** Whether this tab is the one shown: a hidden one must not redirect. */
export function usePaneVisible(): boolean {
  return useContext(PaneVisible);
}

/**
 * The address's query for a tab page. A hidden tab keeps the one it last
 * had, so moving around elsewhere doesn't re-render it.
 */
export function usePaneParams(): URLSearchParams {
  return useContext(PaneParams) ?? EMPTY;
}
const EMPTY = new URLSearchParams();

/**
 * The tab pages, each rendered once and then kept: the one you're on is
 * shown, the others wait hidden and already rendered, so a tab tap only
 * swaps which is visible. They're all rendered ahead once the app is idle,
 * so even the first visit is instant. Hidden tabs take new data at low
 * priority, in the background, and keep their last query. Each tab keeps its
 * own scroll position, as iOS tabs do.
 */
export function TabPanes({ current }: { current: string | null }) {
  const all = panes();
  const [kept, setKept] = useState<string[]>(() => (current ? [current] : []));
  useEffect(() => {
    if (current && !kept.includes(current)) setKept((k) => [...k, current]);
  }, [current, kept]);
  useEffect(() => {
    const warm = () => setKept(Object.keys(panes()));
    const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) {
      const id = idle(warm, { timeout: 2000 });
      return () => (window as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 800);
    return () => window.clearTimeout(id);
  }, []);

  // Where each tab was scrolled to, put back when it's shown again.
  const scroll = useRef<Record<string, number>>({});
  const shown = useRef<string | null>(current);
  useLayoutEffect(() => {
    if (shown.current === current) return;
    shown.current = current;
    window.scrollTo(0, (current && scroll.current[current]) || 0);
  }, [current]);
  useEffect(() => {
    if (!current) return;
    const save = () => (scroll.current[current] = window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [current]);

  const query = useSearchParams().toString();
  return (
    <>
      {Object.entries(all).map(([path, Page]) =>
        kept.includes(path) || path === current ? <Pane key={path} Page={Page} visible={path === current} query={query} /> : null
      )}
    </>
  );
}

/**
 * One tab. Its page element is made once, so it only re-renders for what it
 * reads: the shell (the live one when shown, a deferred copy when hidden)
 * and its query (frozen while hidden).
 */
const Pane = memo(function Pane({ Page, visible, query }: { Page: ComponentType; visible: boolean; query: string }) {
  const live = useContext(ShellContext);
  const deferred = useDeferredValue(live);
  const kept = useRef(query);
  if (visible) kept.current = query;
  const params = useMemo(() => new URLSearchParams(kept.current), [kept.current]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = useMemo(() => <Page />, [Page]);
  return (
    <ShellContext.Provider value={visible ? live : deferred}>
      <PaneParams.Provider value={params}>
        <PaneVisible.Provider value={visible}>
          <div className="tab-pane" hidden={!visible}>
            {page as ReactNode}
          </div>
        </PaneVisible.Provider>
      </PaneParams.Provider>
    </ShellContext.Provider>
  );
});
