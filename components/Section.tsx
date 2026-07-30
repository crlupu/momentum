"use client";

import { ReactNode, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionMotif, sectionIndex, sectionTitle, type SectionId } from "@/components/SectionMotif";

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
 * The coloured plate that introduces a section: index, title, and the section's
 * motif. Renders as a button when it toggles something and as a plain heading
 * when it doesn't — the treatment is identical either way, so a section looks
 * the same on a phone and on an iPad.
 */
export function SectionBand({
  id,
  title,
  size = "lg",
  collapsible,
  open,
  onToggle,
  className: extraClass,
}: {
  id: SectionId;
  /** Defaults to the registry title; pass only to override it. */
  title?: string;
  size?: "lg" | "md";
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  const className = ["sec-band", size === "md" ? "sec-band--md" : "", extraClass]
    .filter(Boolean)
    .join(" ");
  const style = {
    ["--band-color" as string]: `var(--sec-${id})`,
    ["--band-ink" as string]: `var(--ink-${id})`,
  } as React.CSSProperties;

  const inner = (
    <>
      <span className="sec-band__label">
        <span className="sec-band__index">{sectionIndex(id)}</span>
        <span className="sec-band__title">{title ?? sectionTitle(id)}</span>
      </span>
      <span className="sec-band__motif" aria-hidden>
        <SectionMotif id={id} />
      </span>
      {collapsible && (
        <span className={"sec-band__chevron" + (open ? " sec-band__chevron--open" : "")}>
          <ChevronDown className="h-5 w-5" aria-hidden />
        </span>
      )}
    </>
  );

  if (collapsible) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className={className}
        style={style}
      >
        {inner}
      </button>
    );
  }

  return (
    <h2 className={className} style={style}>
      {inner}
    </h2>
  );
}

/**
 * A titled region of the page. On phones the band is a toggle and the body
 * starts collapsed; from the tablet breakpoint up everything is always shown
 * and the band is inert.
 */
export function Section({
  id,
  title,
  open,
  onToggle,
  isDesktop,
  size = "lg",
  className,
  children,
}: {
  id: SectionId;
  title?: string;
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

  return (
    <section id={id} className={["section-panel scroll-mt-6", className].filter(Boolean).join(" ")}>
      <SectionBand
        id={id}
        title={title}
        size={size}
        collapsible={collapsible}
        open={open}
        onToggle={onToggle}
      />

      <div id={`${id}-body`} hidden={!shown} className="section-panel__body">
        {children}
      </div>
    </section>
  );
}
