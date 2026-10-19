"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function PrintTrigger() {
  const searchParams = useSearchParams();
  const shouldPrint = searchParams.get("print") === "1";

  useEffect(() => {
    if (shouldPrint) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [shouldPrint]);

  return null;
}