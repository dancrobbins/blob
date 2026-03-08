"use client";

import React, { useEffect, useRef } from "react";
import styles from "./ConfirmDialog.module.css";

export function MergeDialog({
  onPull,
  onDiscard,
}: {
  onPull: () => void;
  onDiscard: () => void;
}) {
  const discardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    discardRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDiscard();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onDiscard]);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onDiscard();
      }}
    >
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="merge-dialog-title">
        <p id="merge-dialog-title" className={styles.message}>
          You have blobs saved locally. Pull them into your cloud-synced set?
        </p>
        <div className={styles.buttons}>
          <button
            ref={discardRef}
            type="button"
            className={styles.cancel}
            onClick={onDiscard}
          >
            Discard local
          </button>
          <button
            type="button"
            className={styles.confirm}
            onClick={onPull}
          >
            Pull into cloud
          </button>
        </div>
      </div>
    </div>
  );
}
