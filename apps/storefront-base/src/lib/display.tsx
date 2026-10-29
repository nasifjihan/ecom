"use client";

/** What product cards and pages show (Online Store > Theme > Product display). */
import * as React from "react";

export interface DisplaySettings {
  showRating: boolean;
  showSoldCount: boolean;
  showLowStock: boolean;
  /** "Only a few left" below this many, for products without their own level. */
  lowStockThreshold: number;
  /** The store-wide size chart link ("" when there is none). */
  sizeGuideUrl: string;
}

export const DEFAULT_DISPLAY: DisplaySettings = { showRating: true, showSoldCount: true, showLowStock: true, lowStockThreshold: 5, sizeGuideUrl: "" };

const DisplayContext = React.createContext<DisplaySettings>(DEFAULT_DISPLAY);

export function DisplayProvider({ value, children }: { value?: Partial<DisplaySettings>; children: React.ReactNode }) {
  const merged = React.useMemo(() => ({ ...DEFAULT_DISPLAY, ...value }), [value]);
  return <DisplayContext.Provider value={merged}>{children}</DisplayContext.Provider>;
}

export const useDisplay = () => React.useContext(DisplayContext);
