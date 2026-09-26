"use client";

import { ReactNode, useEffect } from "react";
import { sectionIndex, sectionTitle, type SectionId } from "@/components/sections";

/**
 * The heading that introduces a section: its index and title.
 */
export function SectionBand({
  id,
  title,
  size = "lg",
  className: extraClass,
}: {
  id: SectionId;
  /** Defaults to the registry title; pass only to override it. */
  title?: string;
  size?: "lg" | "md";
  className?: string;
}) {
  const className = ["sec-band", size === "md" ? "sec-band--md" : "", extraClass]
    .filter(Boolean)
    .join(" ");
  const style = {
    ["--band-color" as string]: `var(--sec-${id})`,
    ["--band-ink" as string]: `var(--ink-${id})`,
  } as React.CSSProperties;

  return (
    <h2 className={className} style={style}>
      <span className="sec-band__label">
        <span className="sec-band__index">{sectionIndex(id)}</span>
        <span className="sec-band__title">{title ?? sectionTitle(id)}</span>
      </span>
    </h2>
  );
}

/**
 * A section's page: its heading, then its content.
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
  useEffect(() => {
    document.title = id === "goals" ? "Momentum" : `${sectionTitle(id)} · Momentum`;
  }, [id]);

  return (
    <section id={id} className="section-panel">
      <SectionBand id={id} size={size} />
      <div className="section-panel__body">{children}</div>
    </section>
  );
}
