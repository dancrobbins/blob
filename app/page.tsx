"use client";

import React, { useCallback, useRef } from "react";
import { Header } from "@/components/Header";
import { Blobby } from "@/components/Blobby";
import { BlobCard } from "@/components/BlobCard";
import { useBlobsContext } from "@/contexts/BlobsContext";
import styles from "./page.module.css";

export default function Home() {
  const { blobs, dispatch } = useBlobsContext();
  const pointerDownOnCanvas = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-blob-card]") && !target.closest("header")) {
      pointerDownOnCanvas.current = true;
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (!pointerDownOnCanvas.current) return;
      pointerDownOnCanvas.current = false;
      if (target.closest("[data-blob-card]") || target.closest("header")) return;
      dispatch({
        type: "ADD_BLOB",
        payload: { x: e.clientX - 24, y: e.clientY - 24 },
      });
      window.dispatchEvent(new CustomEvent("blob:user-action"));
    },
    [dispatch]
  );

  return (
    <main className={styles.main}>
      <Header />
      <div
        className={styles.canvas}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {blobs.map((blob) => (
          <BlobCard
            key={blob.id}
            blob={blob}
            onUpdate={(content) =>
              dispatch({ type: "UPDATE_BLOB", payload: { id: blob.id, content } })
            }
            onPosition={(x, y) =>
              dispatch({
                type: "SET_POSITION",
                payload: { id: blob.id, x, y },
              })
            }
            onFocus={() => window.dispatchEvent(new CustomEvent("blob:user-action"))}
          />
        ))}
      </div>
      <Blobby />
    </main>
  );
}
