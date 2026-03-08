"use client";

import React, { createContext, useRef, useCallback, useState, type ReactNode } from "react";

type ControlsPortalContextValue = {
  portalRef: React.RefObject<HTMLDivElement | null>;
  setPortalContainer: (node: HTMLDivElement | null) => void;
  portalReady: boolean;
};

const ControlsPortalContext = createContext<ControlsPortalContextValue | null>(null);

export function ControlsPortalProvider({ children }: { children: ReactNode }) {
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const setPortalContainer = useCallback((node: HTMLDivElement | null) => {
    (portalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setPortalReady(!!node);
  }, []);

  return (
    <ControlsPortalContext.Provider value={{ portalRef, setPortalContainer, portalReady }}>
      {children}
    </ControlsPortalContext.Provider>
  );
}

export function useControlsPortal() {
  return React.useContext(ControlsPortalContext);
}
