"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The width an element actually has, so a chart is drawn at that size.
 * Scaling one fixed drawing to fit would scale its text and marks with it:
 * tiny on a phone, huge on a desktop.
 */
export function useWidth<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
