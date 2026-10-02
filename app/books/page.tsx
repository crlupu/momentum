"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Books are part of Learning now. Old links land there. */
export default function BooksRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/learning");
  }, [router]);
  return null;
}
