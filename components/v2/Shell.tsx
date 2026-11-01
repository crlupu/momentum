"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  IoAlbums, IoAlbumsOutline, IoBarChartOutline, IoCalendar, IoCalendarClearOutline, IoCalendarOutline, IoDocumentTextOutline,
  IoHeart, IoHeartOutline, IoListOutline, IoSchool, IoSchoolOutline, IoSettingsOutline,
} from "react-icons/io5";
import type { IconType } from "react-icons";
import { Plus } from "../icons";
import { Logo } from "../Logo";
import type { Tracker } from "@/lib/tracker";
import { AddSheet } from "./AddSheet";

/**
 * The v2 shell: the tab bar with the + on its right on a phone and tablet,
 * a sidebar from 66rem. Areas not rebuilt yet still link to the current app.
 */
type Dest = { href: string; title: string; icon: IconType; on: IconType; key?: string };
const AREAS: Dest[] = [
  { href: "/v2", title: "Today", icon: IoCalendarOutline, on: IoCalendar, key: "1" },
  { href: "/education", title: "Education", icon: IoSchoolOutline, on: IoSchool, key: "2" },
  { href: "/projects", title: "Projects", icon: IoAlbumsOutline, on: IoAlbums, key: "3" },
  { href: "/fitness", title: "Health", icon: IoHeartOutline, on: IoHeart, key: "4" },
];
const PLAN: Dest[] = [
  { href: "/week", title: "Week", icon: IoCalendarClearOutline, on: IoCalendarClearOutline },
  { href: "/plan", title: "Day plan", icon: IoListOutline, on: IoListOutline },
];
const BACK: Dest[] = [
  { href: "/progress", title: "Progress", icon: IoBarChartOutline, on: IoBarChartOutline },
  { href: "/log", title: "Log", icon: IoDocumentTextOutline, on: IoDocumentTextOutline },
  { href: "/configuration", title: "Settings", icon: IoSettingsOutline, on: IoSettingsOutline },
];

function trim(p: string) {
  return p.replace(/\/+$/, "") || "/";
}

export function V2Shell({ tracker, children }: { tracker: Tracker; children: ReactNode }) {
  const path = trim(usePathname() ?? "/");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const current = (href: string) => (trim(href) === path ? "page" : undefined);

  // Keyboard on a desk: N adds, 1 to 4 open the areas. Never while typing or over a sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        setAdding(true);
      } else if (/^[1-4]$/.test(k)) {
        e.preventDefault();
        router.push(AREAS[Number(k) - 1].href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const link = (d: Dest) => {
    const on = current(d.href);
    const I = on ? d.on : d.icon;
    return (
      <Link key={d.href} href={d.href} className="v2-side__link" aria-current={on}>
        <I aria-hidden />
        {d.title}
      </Link>
    );
  };

  return (
    <div className="v2 v2-frame">
      <nav className="v2-side" aria-label="Sections">
        <Link href="/v2" className="v2-side__mark" aria-label="Momentum, go to Today">
          <Logo className="h-5 w-auto" />
          Momentum
        </Link>
        <button type="button" className="v2-btn v2-btn--primary" onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Add
        </button>
        {AREAS.map(link)}
        <span className="v2-side__gap" />
        {PLAN.map(link)}
        <span className="v2-side__gap" />
        {BACK.map(link)}
      </nav>
      <main className="v2-main">{children}</main>
      <nav className="v2-bar" aria-label="Areas">
        <span className="v2-bar__tabs">
          {AREAS.map((d) => {
            const on = current(d.href);
            const I = on ? d.on : d.icon;
            return (
              <Link key={d.href} href={d.href} className="v2-bar__tab" aria-current={on} aria-label={d.title}>
                <I aria-hidden />
              </Link>
            );
          })}
        </span>
        <button type="button" className="v2-bar__add" aria-label="Add" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
        </button>
      </nav>
      <AddSheet tracker={tracker} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
