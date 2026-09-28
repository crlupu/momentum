"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Tasks became Today, at the home page. Old links and bookmarks land there. */
export default function TasksRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
