"use client";

import { usePageTracker } from "@/components/AppShell";
import { SectionPage } from "@/components/Section";
import { Books } from "@/components/Books";

export default function BooksPage() {
  const tracker = usePageTracker();
  return (
    <SectionPage id="books">
      <Books tracker={tracker} />
    </SectionPage>
  );
}
