"use client";

import React, { createContext, useRef, useCallback, useState, type ReactNode } from "react";

type PopupPortalContextValue = {
  portalRef: React.RefObject<HTMLDivElement | null>;
  setPortalContainer: (node: HTMLDivElement | null) => void;
  portalReady: boolean;
};

const PopupPortalContext = createContext<PopupPortalContextValue | null>(null);

export function PopupPortalProvider({ children }: { children: ReactNode }) {
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const setPortalContainer = useCallback((node: HTMLDivElement | null) => {
    (portalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setPortalReady(!!node);
  }, []);

  return (
    <PopupPortalContext.Provider value={{ portalRef, setPortalContainer, portalReady }}>
      {children}
    </PopupPortalContext.Provider>
  );
}

export function usePopupPortal() {
  return React.useContext(PopupPortalContext);
}
