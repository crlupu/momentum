"use client";

import { ReactNode, useEffect } from "react";
import { sectionTitle, type SectionId } from "@/components/sections";
import { useShell } from "@/components/AppShell";
import { TodayStats } from "@/components/TodayStats";
import { MoreHorizontal } from "@/components/icons";

/**
 * The heading that introduces a section: its title, as the page's large
 * title, in the section's own colour.
 */
export function SectionBand({
  id,
  title,
  size = "lg",
  className: extraClass,
  children,
}: {
  id: SectionId;
  /** Defaults to the registry title; pass only to override it. */
  title?: string;
  size?: "lg" | "md";
  className?: string;
  /** Anything that sits at the trailing end of the title row. */
  children?: ReactNode;
}) {
  const className = ["sec-band", size === "md" ? "sec-band--md" : "", extraClass]
    .filter(Boolean)
    .join(" ");
  const style = { ["--band-color" as string]: `var(--sec-${id})` } as React.CSSProperties;

  return (
    <div className={className} style={style}>
      <h1 className="sec-band__title">{title ?? sectionTitle(id)}</h1>
      {children}
    </div>
  );
}

/**
 * A section's page: its title, today's figures, then its content.
 *
 * Also names the browser tab after the section. The pages are client
 * components, which can't export metadata, and a tab reading "Momentum" on
 * every page gives no clue which one it is.
 */
export function SectionPage({
  id,
  size = "lg",
  children,
}: {
  id: SectionId;
  size?: "lg" | "md";
  children: ReactNode;
}) {
  const { tracker, openMore } = useShell();

  useEffect(() => {
    document.title = id === "goals" ? "Momentum" : `${sectionTitle(id)} · Momentum`;
  }, [id]);

  return (
    <section id={id} className="section-panel">
      <SectionBand id={id} size={size}>
        {/* Phones and tablets only: the sidebar holds these on a desktop. */}
        <button
          type="button"
          onClick={openMore}
          aria-label="More"
          className="more-button lg:hidden"
        >
          <MoreHorizontal aria-hidden />
        </button>
      </SectionBand>
      <TodayStats tracker={tracker} layout="strip" className="mt-3 lg:hidden" />
      <div className="section-panel__body">{children}</div>
    </section>
  );
}
