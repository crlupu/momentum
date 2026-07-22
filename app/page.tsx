"use client";

import { useState } from "react";
import { Button, Tabs } from "@heroui/react";
import { LogOut } from "lucide-react";
import { useTracker } from "@/lib/tracker";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { AuthGate } from "@/components/AuthGate";
import TodayView from "@/components/TodayView";
import BoardView from "@/components/BoardView";
import ProgressView from "@/components/ProgressView";

export default function Home() {
  const tracker = useTracker();
  const [tab, setTab] = useState("today");

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="mx-auto max-w-[980px] px-4 pb-12 sm:px-5">
      <header className="flex items-center justify-between pt-5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-display text-2xl font-bold tracking-tight">Momentum</h1>
          <span className="font-mono-n text-[13px] text-foreground/60">{today}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitch />
          {tracker.user && (
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label="Sign out"
              onPress={() => tracker.signOutUser()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <AuthGate tracker={tracker}>
        <div className="pt-4">
          {!tracker.state ? (
            <p className="text-foreground/60">Loading…</p>
          ) : (
            <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
              <Tabs.List className="mb-4">
                <Tabs.Tab id="today">Today</Tabs.Tab>
                <Tabs.Tab id="board">Board</Tabs.Tab>
                <Tabs.Tab id="progress">Progress</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel id="today">
                <TodayView tracker={tracker} />
              </Tabs.Panel>
              <Tabs.Panel id="board">
                <BoardView tracker={tracker} />
              </Tabs.Panel>
              <Tabs.Panel id="progress">
                <ProgressView tracker={tracker} />
              </Tabs.Panel>
            </Tabs>
          )}
        </div>
      </AuthGate>
    </div>
  );
}
