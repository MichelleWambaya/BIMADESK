import React, { createContext, useContext, useEffect, useState } from "react";

export type FontScale = "default" | "large" | "larger";
const SCALE_VALUES: Record<FontScale, number> = { default: 1, large: 1.125, larger: 1.25 };

interface AccessibilityContextValue {
  fontScale: FontScale;
  setFontScale: (s: FontScale) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
}

const FONT_KEY = "bimadesk_font_scale";
const MOTION_KEY = "bimadesk_reduce_motion";
const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const stored = localStorage.getItem(FONT_KEY);
    return stored === "large" || stored === "larger" ? stored : "default";
  });
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => localStorage.getItem(MOTION_KEY) === "true");

  useEffect(() => {
    document.documentElement.style.setProperty("--a11y-scale", String(SCALE_VALUES[fontScale]));
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reduce-motion", reduceMotion ? "true" : "false");
  }, [reduceMotion]);

  function setFontScale(s: FontScale) {
    localStorage.setItem(FONT_KEY, s);
    setFontScaleState(s);
  }

  function setReduceMotion(v: boolean) {
    localStorage.setItem(MOTION_KEY, String(v));
    setReduceMotionState(v);
  }

  return (
    <AccessibilityContext.Provider value={{ fontScale, setFontScale, reduceMotion, setReduceMotion }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}
