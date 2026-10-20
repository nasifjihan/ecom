"use client";

/**
 * Data-saver mode: product pictures load as small thumbnails. On when the shopper turns it on, or,
 * until they choose, when their phone or browser asks to save data (the Save-Data hint).
 */
import { useSyncExternalStore } from "react";

const KEY = "dataSaver";
const EVENT = "datasaver-change";

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) return v === "1";
  } catch {
    /* storage blocked: fall through to the browser's hint */
  }
  return !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setDataSaver(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* not remembered, but still applies to this page */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Off while rendering on the server, so the first paint matches; switches on after hydration. */
export const useDataSaver = () => useSyncExternalStore(subscribe, read, () => false);
