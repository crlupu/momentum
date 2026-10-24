"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { HealthSwitch } from "@/components/HealthSwitch";
import WeightTracker, { WeeklyMedians } from "@/components/WeightTracker";
import WeightPlanCard from "@/components/WeightPlan";
import WorkoutVolumeChart from "@/components/WorkoutVolumeChart";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { UpNextWorkout } from "@/components/UpNextWorkout";
import { WorkoutScreen, WorkoutsList } from "@/components/WorkoutScreens";
import { ActiveWorkoutPanel } from "@/components/WorkoutsView";

/**
 * Fitness, as Apple Health lays it out: a short summary of weight and
 * training, each opening a page of its own with the charts and the plan.
 */
function Fitness() {
  const tracker = usePageTracker();
  const params = useSearchParams();
  const view = params.get("view");
  const id = params.get("id");
  const router = useRouter();
  // Finishing or cancelling the live workout ends it; its screen goes back
  // to Health rather than standing empty.
  const live = view === "live" && !!tracker.state?.activeWorkout;
  useEffect(() => {
    if (view === "live" && !live) router.replace("/fitness");
  }, [view, live, router]);
  const back = (
    <Link href="/fitness" className="back-link">
      <ChevronLeft aria-hidden />
      Health
    </Link>
  );
  if (view === "live") {
    const active = tracker.state?.activeWorkout;
    return (
      <SectionPage id="fitness" title={active?.name ?? "Workout"} subtitle={back}>
        {active ? (
          <ActiveWorkoutPanel tracker={tracker} active={active} />
        ) : (
          <p className="text-[15px] text-[var(--muted)]">
            No workout under way. Start one from <Link href="/fitness" className="text-[var(--accent-text)]">Health</Link>.
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
          <WorkoutScreen tracker={tracker} workout={w} onDeleted={() => router.replace("/fitness?view=workouts")} />
        ) : (
          <p className="text-[15px] text-[var(--muted)]">This workout is gone.</p>
        )}
      </SectionPage>
    );
  }
  if (view === "weight") {
    return (
      <SectionPage id="fitness" title="Weight" subtitle={back}>
        <div className="space-y-5">
          <WeightTracker tracker={tracker} />
          <WeightPlanCard tracker={tracker} />
          <WeeklyMedians weights={tracker.state?.weights ?? []} />
        </div>
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
    <SectionPage id="fitness" title="Health" header={<HealthSwitch current="fitness" />}>
      <div className="space-y-5">
        <UpNextWorkout tracker={tracker} />
        <WeightTracker tracker={tracker} summary />
        <WorkoutVolumeChart tracker={tracker} summary />
        {/* The pages behind the summary, as one list of rows. */}
        <nav className="group-list" aria-label="More in Fitness">
          <Link href="/fitness?view=weight" className="group-row">
            <span className="flex-1">Weight and plan</span>
            <ChevronRight className="group-row__chev" aria-hidden />
          </Link>
          <Link href="/fitness?view=training" className="group-row">
            <span className="flex-1">Volume by workout</span>
            <ChevronRight className="group-row__chev" aria-hidden />
          </Link>
          <Link href="/fitness?view=workouts" className="group-row">
            <span className="flex-1">Workouts</span>
            <span className="group-row__value">{tracker.state?.workouts.length ?? 0}</span>
            <ChevronRight className="group-row__chev" aria-hidden />
          </Link>
        </nav>
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
