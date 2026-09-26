"use client";

import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import WeightTracker from "@/components/WeightTracker";
import WorkoutVolumeChart from "@/components/WorkoutVolumeChart";

export default function FitnessPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage id="fitness">
      <div className="space-y-5">
        <WeightTracker tracker={tracker} />
        <WorkoutVolumeChart tracker={tracker} />
      </div>
    </SectionPage>
  );
}
