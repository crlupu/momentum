"use client";

import { ReactNode, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Below this width sections collapse. Set at the tablet breakpoint so phones
 * get the collapsible list while iPads and up show everything expanded.
 */
const DESKTOP = "(min-width: 768px)";

/**
 * Tracks whether we're on a desktop-width viewport.
 * Starts as null so the first render matches the prerendered HTML, then
 * resolves after mount — otherwise hydration mismatches.
 */
export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isDesktop;
}

/**
 * A titled region of the page. On phones the heading is a toggle and the body
 * starts collapsed; from the tablet breakpoint up everything is always shown
 * and the heading is inert.
 */
export function Section({
  id,
  title,
  gradient,
  open,
  onToggle,
  isDesktop,
  size = "lg",
  className,
  children,
}: {
  id: string;
  title: string;
  gradient: string;
  open: boolean;
  onToggle: () => void;
  isDesktop: boolean | null;
  size?: "lg" | "md";
  className?: string;
  children: ReactNode;
}) {
  // Until the media query resolves, render as expanded so the prerendered
  // markup contains the content (and search/anchors still work).
  const collapsible = isDesktop === false;
  const shown = !collapsible || open;

  const heading = (
    <>
      <span className="sec-dot" style={{ background: gradient }} aria-hidden />
      <span className="flex-1 text-left">{title}</span>
      {collapsible && (
        <ChevronDown
          className={"h-5 w-5 shrink-0 transition-transform " + (open ? "rotate-180" : "")}
          aria-hidden
        />
      )}
    </>
  );

  const headingClass =
    "font-display flex w-full items-center gap-2.5 font-bold tracking-tight " +
    (size === "lg" ? "text-2xl" : "text-xl");

  return (
    <section id={id} className={["section-panel scroll-mt-6", className].filter(Boolean).join(" ")}>
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className={headingClass + (shown ? " mb-4" : "")}
        >
          {heading}
        </button>
      ) : (
        <h2 className={headingClass + " mb-4"}>{heading}</h2>
      )}

      <div id={`${id}-body`} hidden={!shown}>
        {children}
      </div>
    </section>
  );
}
