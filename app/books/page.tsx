"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Books are part of Education now. Old links land there. */
export default function BooksRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/education");
  }, [router]);
  return null;
}
