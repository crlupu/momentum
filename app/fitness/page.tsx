"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { usePaneParams, usePaneVisible } from "@/components/TabPanes";
import { SectionPage } from "@/components/Section";
import { HealthSwitch } from "@/components/HealthSwitch";
import WeightTracker, { WeeklyMedians } from "@/components/WeightTracker";
import WeightPlanCard from "@/components/WeightPlan";
import { MeasurementsCard, MeasurementsPage } from "@/components/Measurements";
import WorkoutVolumeChart from "@/components/WorkoutVolumeChart";
import { ChevronLeft } from "@/components/icons";
import { UpNextWorkout } from "@/components/UpNextWorkout";
import { WorkoutScreen, WorkoutsList } from "@/components/WorkoutScreens";
import { ActiveWorkoutPanel, LiveActions } from "@/components/WorkoutsView";

/**
 * Fitness, as Apple Health lays it out: a short summary of weight and
 * training, each opening a page of its own with the charts and the plan.
 */
function Fitness() {
  const tracker = usePageTracker();
  const params = usePaneParams();
  const view = params.get("view");
  const id = params.get("id");
  const router = useRouter();
  // Finishing or cancelling the live workout ends it; its screen goes back
  // to Health rather than standing empty.
  const live = view === "live" && !!tracker.state?.activeWorkout;
  const shown = usePaneVisible();
  // Done in place rather than through the router: only the query changes,
  // and a router move fetches the page anew, which after a deploy meant a
  // full reload, and a blank screen, the moment a workout was finished.
  useEffect(() => {
    if (shown && view === "live" && !live)
      window.history.replaceState(null, "", window.location.pathname);
  }, [shown, view, live]);
  // While lifting, the tab bar steps aside, as it does for focus: the
  // Finish card is the bottom of the screen.
  useEffect(() => {
    if (!(shown && live)) return;
    document.documentElement.classList.add("is-working-out");
    return () => document.documentElement.classList.remove("is-working-out");
  }, [shown, live]);
  const back = (
    <Link href="/fitness" className="back-link">
      <ChevronLeft aria-hidden />
      Health
    </Link>
  );
  if (view === "live") {
    const active = tracker.state?.activeWorkout;
    return (
      <SectionPage
        id="fitness"
        title={active?.name ?? "Workout"}
        subtitle={back}
        actions={
          active ? <LiveActions tracker={tracker} active={active} /> : undefined
        }
      >
        {active ? (
          <ActiveWorkoutPanel tracker={tracker} active={active} />
        ) : (
          <p className="text-[15px] text-[var(--muted)]">
            No workout under way. Start one from{" "}
            <Link href="/fitness" className="text-[var(--accent-text)]">
              Health
            </Link>
            .
          </p>
        )}
      </SectionPage>
    );
  }
  if (view === "workouts") {
    return (
      <SectionPage id="fitness" title="Workouts" subtitle={back}>
        <WorkoutsList tracker={tracker} />
      </SectionPage>
    );
  }
  if (view === "workout") {
    const w = tracker.state?.workouts.find((x) => x.id === id);
    return (
      <SectionPage
        id="fitness"
        title={w?.name ?? "Workout"}
        subtitle={
          <Link href="/fitness?view=workouts" className="back-link">
            <ChevronLeft aria-hidden />
            Workouts
          </Link>
        }
      >
        {w ? (
          <WorkoutScreen
            tracker={tracker}
            workout={w}
            onDeleted={() => router.replace("/fitness?view=workouts")}
          />
        ) : (
          <p className="text-[15px] text-[var(--muted)]">
            This workout is gone.
          </p>
        )}
      </SectionPage>
    );
  }
  if (view === "weight") {
    return (
      <SectionPage id="fitness" tone="body" title="Weight" subtitle={back}>
        <div className="space-y-5">
          <WeightTracker tracker={tracker} />
          <WeightPlanCard tracker={tracker} />
          <WeeklyMedians weights={tracker.state?.weights ?? []} />
        </div>
      </SectionPage>
    );
  }
  if (view === "measurements") {
    return (
      <SectionPage
        id="fitness"
        tone="body"
        title="Measurements"
        subtitle={back}
      >
        <MeasurementsPage tracker={tracker} />
      </SectionPage>
    );
  }
  if (view === "training") {
    return (
      <SectionPage id="fitness" title="Training" subtitle={back}>
        <WorkoutVolumeChart tracker={tracker} />
      </SectionPage>
    );
  }
  return (
    <SectionPage
      id="fitness"
      title="Health"
      header={<HealthSwitch current="fitness" />}
    >
      {/* Training on the left, the body on the right from iPad landscape;
          Weight and Measurements keep their own colour on this page. */}
      <div className="health-grid">
        <div className="health-grid__next">
          <UpNextWorkout tracker={tracker} />
        </div>
        <div className="health-grid__volume">
          <WorkoutVolumeChart tracker={tracker} summary />
        </div>
        <div className="health-grid__weight tone-scope tone-body">
          <WeightTracker tracker={tracker} summary />
        </div>
        <div className="health-grid__measure tone-scope tone-body">
          <MeasurementsCard tracker={tracker} />
        </div>
      </div>
    </SectionPage>
  );
}

export default function FitnessPage() {
  return (
    <Suspense fallback={null}>
      <Fitness />
    </Suspense>
  );
}
