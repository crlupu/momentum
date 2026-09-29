"use client";

import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { HealthSwitch } from "@/components/HealthSwitch";
import WeightTracker from "@/components/WeightTracker";
import WorkoutVolumeChart from "@/components/WorkoutVolumeChart";

export default function FitnessPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage id="fitness" title="Health" header={<HealthSwitch current="fitness" />}>
      <div className="space-y-5">
        <WeightTracker tracker={tracker} />
        <WorkoutVolumeChart tracker={tracker} />
      </div>
    </SectionPage>
  );
}
