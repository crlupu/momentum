"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePageTracker } from "@/components/AppShell";
import { usePaneParams, usePaneVisible } from "@/components/TabPanes";
import { SectionPage } from "@/components/Section";
import { BackToProjects, ProjectList, ProjectPage } from "@/components/ProjectsView";

/**
 * Projects, and a project's board. The board is the same page with the
 * project in the address (?p=…), so it can be bookmarked, and the back
 * button and the "‹ Projects" link both return to the list.
 */
function Projects() {
  const tracker = usePageTracker();
  const router = useRouter();
  const params = usePaneParams();
  const openId = params.get("p");
  const project = openId ? tracker.state?.projects.find((p) => p.id === openId) : undefined;

  // A project that no longer exists (deleted, or a stale link): back to the list.
  const shown = usePaneVisible();
  useEffect(() => {
    if (shown && openId && tracker.state && !project) router.replace("/projects");
  }, [shown, openId, project, tracker.state, router]);

  if (project) {
    return (
      <SectionPage id="projects" title={project.title} subtitle={<BackToProjects href="/projects" />}>
        <ProjectPage key={project.id} tracker={tracker} project={project} />
      </SectionPage>
    );
  }
  return (
    <SectionPage id="projects">
      <ProjectList tracker={tracker} onOpen={(id) => router.push(`/projects?p=${id}`)} />
    </SectionPage>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <Projects />
    </Suspense>
  );
}
