"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { HealthSwitch } from "@/components/HealthSwitch";
import WeightTracker from "@/components/WeightTracker";
import WeightPlanCard from "@/components/WeightPlan";
import WorkoutVolumeChart from "@/components/WorkoutVolumeChart";
import { ChevronLeft } from "@/components/icons";

/**
 * Fitness, as Apple Health lays it out: a short summary of weight and
 * training, each opening a page of its own with the charts and the plan.
 */
function Fitness() {
  const tracker = usePageTracker();
  const view = useSearchParams().get("view");
  const back = (
    <Link href="/fitness" className="back-link">
      <ChevronLeft aria-hidden />
      Fitness
    </Link>
  );
  if (view === "weight") {
    return (
      <SectionPage id="fitness" title="Weight" subtitle={back}>
        <div className="space-y-5">
          <WeightTracker tracker={tracker} />
          <WeightPlanCard tracker={tracker} />
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
        <WeightTracker tracker={tracker} summary />
        <WorkoutVolumeChart tracker={tracker} summary />
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
