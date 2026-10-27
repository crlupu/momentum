"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { sectionTitle, type SectionId } from "@/components/sections";

/**
 * The heading that introduces a section: its title, as the page's large
 * title, with an optional line of context beneath it.
 */
export function SectionBand({
  id,
  title,
  subtitle,
  size = "lg",
  className: extraClass,
  children,
}: {
  id: SectionId;
  /** Defaults to the registry title; pass only to override it. */
  title?: string;
  subtitle?: ReactNode;
  size?: "lg" | "md";
  className?: string;
  /** Anything that sits at the trailing end of the title row. */
  children?: ReactNode;
}) {
  const className = ["sec-band", size === "md" ? "sec-band--md" : "", extraClass]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="min-w-0 flex-1">
        {subtitle && <p className="sec-band__subtitle">{subtitle}</p>}
        <h1 className="sec-band__title">{title ?? sectionTitle(id)}</h1>
      </div>
      {children}
    </div>
  );
}

/**
 * A section's page: its title, then its content.
 *
 * On a phone the large title scrolls away with the page, and a compact bar
 * with the title in small type slides in at the top — the pattern people
 * know from every iPhone app. It carries the More button, so that is never
 * out of reach.
 *
 * Also names the browser tab after the section. The pages are client
 * components, which can't export metadata.
 */
export function SectionPage({
  id,
  title,
  size = "lg",
  subtitle,
  header,
  actions,
  children,
}: {
  id: SectionId;
  /** The large title, when it isn't the section's own (Health, over Fitness). */
  title?: string;
  size?: "lg" | "md";
  subtitle?: ReactNode;
  /** Sits under the large title, before the content: a switch between pages. */
  header?: ReactNode;
  /** Beside the title: the page's own actions. (More is in the tab bar.) */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const titleRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    document.title = id === "tasks" ? "Momentum" : `${sectionTitle(id)} · Momentum`;
  }, [id]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), {
      rootMargin: "-8px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id={id} className="section-panel">
      {/* Compact bar: phones and tablets, once the large title is gone. */}
      <div className={"nav-compact bar-material lg:hidden" + (compact ? " is-shown" : "")} aria-hidden={!compact}>
        <span className="nav-compact__title">{title ?? sectionTitle(id)}</span>
      </div>

      <div ref={titleRef}>
        <SectionBand id={id} title={title} size={size} subtitle={subtitle}>
          {actions}
        </SectionBand>
      </div>
      {header}
      <div className="section-panel__body">{children}</div>
    </section>
  );
}
