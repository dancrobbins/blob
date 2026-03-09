/** Event name for closing popup menus (blob "...", header, selection overlay). */
export const BLOB_CLOSE_MENUS_EVENT = "blob:close-menus";

/** When opening a menu, pass which one so others close but the opener stays open. */
export interface BlobCloseMenusDetail {
  exceptBlobMenu?: string;
  exceptHeader?: boolean;
  exceptAccount?: boolean;
  exceptSelection?: boolean;
}

export function dispatchCloseMenus(detail?: BlobCloseMenusDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BLOB_CLOSE_MENUS_EVENT, { detail: detail ?? {} })
  );
}
