"use client";

import { useEffect } from "react";
import { useBlobsContext } from "@/contexts/BlobsContext";

export function ThemeApplied({ children }: { children: React.ReactNode }) {
  const { preferences } = useBlobsContext();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", preferences.theme);
  }, [preferences.theme]);

  return <>{children}</>;
}
