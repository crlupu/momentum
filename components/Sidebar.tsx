"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, LogOut, ChevronRight } from "./icons";
import type { IconType } from "react-icons";
import {
  IoAlbums, IoAlbumsOutline, IoBarChart, IoBarChartOutline, IoCalendar, IoCalendarOutline, IoDocumentText,
  IoDocumentTextOutline, IoHeart, IoCalendarClearOutline, IoListOutline, IoContrastOutline, IoEllipsisHorizontal, IoHeartOutline, IoSchool, IoSchoolOutline, IoSettings, IoSettingsOutline,
} from "react-icons/io5";
import { Logo } from "./Logo";
import { Tracker, completionsByDate, dateKey } from "@/lib/tracker";
import { routineCompletions } from "@/lib/routines";
import { WEEKDAY, planOf, summarizeWeek, weekNumber, weekOf } from "@/lib/plan";
import type { TrackerState } from "@/lib/model";
import { useTheme } from "next-themes";
import {
  NAV, navHolds, navPath, sectionPath, sectionTitle, trimPath, type NavId, type SectionId,
} from "./sections";

// Ionicons: drawn after Apple's SF Symbols. Outlined, and filled for the
// page you're on, as iOS tab bars mark the current tab.
const ICON: Record<NavId | "charts" | "log" | "config", IconType> = {
  tasks: IoCalendarOutline,
  learning: IoSchoolOutline,
  projects: IoAlbumsOutline,
  health: IoHeartOutline,
  charts: IoBarChartOutline,
  log: IoDocumentTextOutline,
  config: IoSettingsOutline,
};
const ICON_ON: typeof ICON = {
  tasks: IoCalendar,
  learning: IoSchool,
  projects: IoAlbums,
  health: IoHeart,
  charts: IoBarChart,
  log: IoDocumentText,
  config: IoSettings,
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
  const Icon = (active ? ICON_ON : ICON)[id];
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
  const Icon = (active ? ICON_ON : ICON)[id];
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
export function TabBar({ onMore }: { onMore: () => void }) {
  const current = useCurrentPath();
  const router = useRouter();
  // Tabs switch on touch-down, as native tab bars do, rather than waiting
  // for the finger to lift; the click that follows is then let go.
  const pressed = useRef<string | null>(null);
  return (
    <nav className="tabbar bar-material" aria-label="Sections">
      {NAV.map(({ id, title }) => {
        const active = navHolds(id, current);
        const Icon = (active ? ICON_ON : ICON)[id];
        const href = navPath(id);
        return (
          <Link
            key={id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={"tabbar__tab" + (active ? " is-active" : "")}
            onPointerDown={(e) => {
              if (active || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
              pressed.current = href;
              router.push(href);
            }}
            onClick={(e) => {
              if (pressed.current === href) e.preventDefault();
              pressed.current = null;
            }}
          >
            <Icon aria-hidden />
            <span className="tabbar__label">{title}</span>
          </Link>
        );
      })}
      {/* More: Progress, Log, the week and plan, settings — where the thumb is. */}
      <span className="tabbar__rule" aria-hidden />
      <button type="button" className="tabbar__tab tabbar__more" aria-label="More" onClick={onMore}>
        <IoEllipsisHorizontal aria-hidden />
      </button>
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

        <MoreGroups tracker={tracker} onClose={onClose} current={current} />

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

/** Things done on a day, as the Log lists them. */
function loggedOn(s: TrackerState, day: string): number {
  return (
    s.todos.filter((t) => t.done && t.doneDate === day).length +
    s.goals.filter((g) => g.done && g.doneDate === day).length +
    s.completions.filter((c) => c.date === day).length +
    s.workoutSessions.filter((w) => w.date === day).length +
    s.calories.filter((c) => c.date === day).length +
    s.macros.filter((m) => m.date === day && (m.protein || m.fiber)).length +
    s.cardio.filter((c) => c.date === day).length
  );
}

/**
 * More's places as grouped rows, each with its number on the right, as iOS
 * Settings does: Look back (Progress, Log), Plan (the Week, the Day plan)
 * and App (Appearance, Settings).
 */
function MoreGroups({ tracker, onClose, current }: { tracker: Tracker; onClose: () => void; current: string }) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const s = tracker.state;
  if (!s) return null;
  const today = dateKey();
  const month = today.slice(0, 7);
  const byDay = completionsByDate([...s.completions, ...routineCompletions(s)]);
  const monthDone = Object.entries(byDay).filter(([k]) => k.startsWith(month)).reduce((a, [, n]) => a + n, 0);
  const week = summarizeWeek(s, weekOf(today), today);
  const plan = planOf(s);
  const look = mounted ? (theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System") : "";
  const groups: { head: string; rows: { href: string; icon: IconType; title: string; value: string }[] }[] = [
    {
      head: "Look back",
      rows: [
        { href: sectionPath("charts"), icon: IoBarChartOutline, title: "Progress", value: `${monthDone} this month` },
        { href: sectionPath("log"), icon: IoDocumentTextOutline, title: "Log", value: `${loggedOn(s, today)} today` },
      ],
    },
    {
      head: "Plan",
      rows: [
        { href: "/week", icon: IoCalendarClearOutline, title: `Week ${weekNumber(week.week)}`, value: `${week.daysDone} of ${week.daysPlanned}` },
        { href: "/plan", icon: IoListOutline, title: "Day plan", value: plan ? `${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"}` : "Make one" },
      ],
    },
    {
      head: "App",
      rows: [
        { href: "/configuration?view=appearance", icon: IoContrastOutline, title: "Appearance", value: look },
        { href: sectionPath("config"), icon: IoSettingsOutline, title: "Settings", value: "" },
      ],
    },
  ];
  return (
    <>
      {groups.map((g) => (
        <section key={g.head} className="more-group">
          <h3 className="more-group__head">{g.head}</h3>
          <ul className="inset-list">
            {g.rows.map((r) => (
              <li key={r.href}>
                <Link href={r.href} onClick={onClose} aria-current={trimPath(r.href) === current ? "page" : undefined} className="inset-list__row">
                  <span className="inset-list__icon" aria-hidden>
                    <r.icon />
                  </span>
                  <span className="flex-1">{r.title}</span>
                  {r.value && <span className="more-value font-mono-n">{r.value}</span>}
                  <ChevronRight className="inset-list__chevron" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
