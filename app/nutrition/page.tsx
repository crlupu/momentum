"use client";

import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import CaloriesTracker from "@/components/CaloriesTracker";
import MacroTracker from "@/components/MacroTracker";

export default function NutritionPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage id="nutrition">
      <div className="grid items-start gap-5 md:grid-cols-2">
        <CaloriesTracker tracker={tracker} />
        <MacroTracker tracker={tracker} />
      </div>
    </SectionPage>
  );
}
