"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Blobby } from "@/components/Blobby";
import { BlobCard } from "@/components/BlobCard";
import { useBlobsContext } from "@/contexts/BlobsContext";
import styles from "./page.module.css";

export default function Home() {
  const { blobs, dispatch, anyMenuOpenRef } = useBlobsContext();
  const pointerDownOnCanvas = useRef(false);
  const menuWasOpenAtPointerDown = useRef(false);
  const prevBlobCountRef = useRef(blobs.length);
  const [focusBlobId, setFocusBlobId] = useState<string | null>(null);

  useEffect(() => {
    if (blobs.length > prevBlobCountRef.current) {
      setFocusBlobId(blobs[blobs.length - 1].id);
    }
    prevBlobCountRef.current = blobs.length;
  }, [blobs.length]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-blob-card]") && !target.closest("header")) {
      pointerDownOnCanvas.current = true;
      menuWasOpenAtPointerDown.current = anyMenuOpenRef.current;
    }
  }, [anyMenuOpenRef]);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (!pointerDownOnCanvas.current) return;
      pointerDownOnCanvas.current = false;
      if (menuWasOpenAtPointerDown.current) return;
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
            autoFocus={blob.id === focusBlobId}
            onAutoFocusDone={() => setFocusBlobId(null)}
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
            onDuplicate={() => dispatch({ type: "DUPLICATE_BLOB", payload: blob.id })}
            onDelete={() => dispatch({ type: "DELETE_BLOB", payload: blob.id })}
          />
        ))}
      </div>
      <Blobby />
    </main>
  );
}
