"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { TwoTabLoginToast } from "./TwoTabLoginToast";
import { TestRunControl } from "./TestRunControl";

export function E2ESyncOverlay() {
  const searchParams = useSearchParams();
  const isTestMode = searchParams?.get("e2eSync") === "1";

  if (!isTestMode) return null;

  return (
    <>
      <TwoTabLoginToast />
      <TestRunControl />
    </>
  );
}
