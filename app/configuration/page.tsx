"use client";

import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { ConfigCard } from "@/components/ConfigCard";
import {
  CategoriesCard,
  GroupsCard,
  RecurringManageCard,
  CalorieBudgetCard,
  MacroTargetsCard,
  MealTagsCard,
} from "@/components/Forms";
import WorkoutsView from "@/components/WorkoutsView";

export default function ConfigurationPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage id="config" size="md">
      {/* Two explicit columns: each card sits straight under the one above it,
          without CSS multi-column (which breaks scrollable lists in Safari). */}
      <div className="grid items-start gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <ConfigCard title="Manage recurring">
            <RecurringManageCard tracker={tracker} />
          </ConfigCard>
          <ConfigCard title="Categories">
            <CategoriesCard tracker={tracker} />
          </ConfigCard>
          <ConfigCard title="Groups">
            <GroupsCard tracker={tracker} />
          </ConfigCard>
        </div>
        <div className="flex flex-col gap-5">
          <ConfigCard title="Workouts">
            <WorkoutsView tracker={tracker} />
          </ConfigCard>
          <ConfigCard title="Meal tags">
            <MealTagsCard tracker={tracker} />
          </ConfigCard>
          <ConfigCard title="Calorie budget">
            <CalorieBudgetCard tracker={tracker} />
          </ConfigCard>
          <ConfigCard title="Protein & fibre targets">
            <MacroTargetsCard tracker={tracker} />
          </ConfigCard>
        </div>
      </div>
    </SectionPage>
  );
}
