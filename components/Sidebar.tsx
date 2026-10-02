"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Today, BarChart3, ScrollText, Settings, LogOut, ChevronRight, School, Kanban,
  Health,
} from "./icons";
import { ThemeSwitch } from "./ThemeSwitch";
import { Logo } from "./Logo";
import { Tracker } from "@/lib/tracker";
import {
  NAV, navHolds, navPath, sectionPath, sectionTitle, trimPath, type NavId, type SectionId,
} from "./sections";

const ICON: Record<NavId | "charts" | "log" | "config", typeof Today> = {
  tasks: Today,
  learning: School,
  projects: Kanban,
  health: Health,
  charts: BarChart3,
  log: ScrollText,
  config: Settings,
};

/**
 * The sections, split by what they are for. The five in NAV are where things
 * get recorded, and are the phone's tabs: Today first, since that is where
 * the app opens; Health holds Fitness and Nutrition. Progress and Log look
 * back over what was recorded; Settings shapes the rest. On a phone those
 * three live behind More.
 */
const REVIEW: SectionId[] = ["charts", "log"];

function useCurrentPath() {
  return trimPath(usePathname() ?? "/");
}

function NavLink({ id, current }: { id: NavId; current: string }) {
  const active = navHolds(id, current);
  const Icon = ICON[id];
  return (
    <Link
      href={navPath(id)}
      aria-current={active ? "page" : undefined}
      className={"side-link" + (active ? " is-active" : "")}
    >
      <span className="side-link__icon" aria-hidden>
        <Icon />
      </span>
      {NAV.find((n) => n.id === id)!.title}
    </Link>
  );
}

function SectionLink({ id, current }: { id: "charts" | "log" | "config"; current: string }) {
  const href = sectionPath(id);
  const active = trimPath(href) === current;
  const Icon = ICON[id];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={"side-link" + (active ? " is-active" : "")}
    >
      <span className="side-link__icon" aria-hidden>
        <Icon />
      </span>
      {sectionTitle(id)}
    </Link>
  );
}

/**
 * Desktop navigation: a sidebar that is always there, from 1056px up.
 *
 * Navigation only — nothing that acts. New goals and new tasks are made on
 * their own pages, next to the lists they join, and today's figures live on
 * Today. Icons are monochrome; the current page is marked in electric blue.
 */
export function Sidebar({ tracker }: { tracker: Tracker }) {
  const current = useCurrentPath();
  return (
    <aside className="sidebar bar-material" aria-label="Sections">
      <Link href="/" className="sidebar__brand" aria-label="Momentum, go to Today">
        <Logo className="h-5 w-auto" />
        <span>Momentum</span>
      </Link>

      <nav className="sidebar__nav">
        {NAV.map((n) => <NavLink key={n.id} id={n.id} current={current} />)}
        <div className="sidebar__gap" />
        <SectionLink id="charts" current={current} />
        <SectionLink id="log" current={current} />
        <SectionLink id="config" current={current} />
      </nav>

      <div className="sidebar__foot">
        <ThemeSwitch className="w-full" />
        {tracker.user && (
          <button type="button" className="side-link" onClick={() => tracker.signOutUser()}>
            <span className="side-link__icon" aria-hidden><LogOut /></span>
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

/**
 * Phone and tablet navigation: a tab bar along the bottom, below 1056px.
 * Five tabs, one per section where things get recorded. Always visible.
 */
export function TabBar() {
  const current = useCurrentPath();
  return (
    <nav className="tabbar bar-material" aria-label="Sections">
      {NAV.map(({ id, title }) => {
        const active = navHolds(id, current);
        const Icon = ICON[id];
        return (
          <Link
            key={id}
            href={navPath(id)}
            aria-current={active ? "page" : undefined}
            className={"tabbar__tab" + (active ? " is-active" : "")}
          >
            <Icon aria-hidden />
            <span>{title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * More, on a phone: the sections that aren't tabs, appearance, and sign-out.
 * A sheet from the bottom, dismissed by the close button, the scrim or Escape.
 */
export function MoreSheet({
  open,
  onClose,
  tracker,
}: {
  open: boolean;
  onClose: () => void;
  tracker: Tracker;
}) {
  const current = useCurrentPath();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="more-title">
      <div className="scrim absolute inset-0" onClick={onClose} aria-hidden />
      <div className="sheet overlay-surface">
        <div className="sheet__grabber" aria-hidden />
        <div className="sheet__head">
          <h2 id="more-title" className="sheet__title">More</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="icon-circle">
            <X aria-hidden />
          </button>
        </div>

        <ul className="inset-list">
          {[...REVIEW, "config" as SectionId].map((id) => {
            const href = sectionPath(id);
            const active = trimPath(href) === current;
            const Icon = ICON[id as "charts" | "log" | "config"];
            return (
              <li key={id}>
                <Link
                  href={href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className="inset-list__row"
                >
                  <span className="inset-list__icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="flex-1">{sectionTitle(id)}</span>
                  <ChevronRight className="inset-list__chevron" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>

        <h3 className="group-label mt-5">Appearance</h3>
        <ThemeSwitch className="w-full" />

        {tracker.user && (
          <ul className="inset-list mt-5">
            <li>
              <button
                type="button"
                className="inset-list__row text-[var(--danger)]"
                onClick={() => { onClose(); void tracker.signOutUser(); }}
              >
                <span className="flex-1 text-left">Sign out</span>
                <LogOut className="h-5 w-5" aria-hidden />
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}
