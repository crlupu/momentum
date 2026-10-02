"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Goals became Education, with projects on a page of their own. Old links land there. */
export default function GoalsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/education");
  }, [router]);
  return null;
}
