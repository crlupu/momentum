"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Learning is called Education now. Old links land there, where they pointed. */
export default function LearningRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/education${window.location.search}`);
  }, [router]);
  return null;
}
