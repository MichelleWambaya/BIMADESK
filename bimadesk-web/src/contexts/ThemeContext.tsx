import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

/** Each preset supplies the same color ramp the Tailwind config's "violet"
 * scale used to hardcode. Swapping the CSS variables at runtime repaints
 * every bg-violet-500 / text-violet-700 class already used across the app,
 * so changing theme doesn't require touching individual components. */
export const THEME_PRESETS = {
  violet: { label: "Violet", rgb: "109, 60, 229", ramp: { 50: "#F1EEFF", 100: "#DCD3FF", 300: "#A78BFA", 500: "#6D3CE5", 600: "#5B2FC2", 700: "#472399" } },
  indigo: { label: "Indigo", rgb: "67, 56, 202", ramp: { 50: "#EEF0FF", 100: "#D9DDFF", 300: "#8B93F5", 500: "#4338CA", 600: "#372DA6", 700: "#2A2280" } },
  sky: { label: "Sky", rgb: "2, 132, 199", ramp: { 50: "#E7F6FF", 100: "#C9EBFF", 300: "#5FC3F5", 500: "#0284C7", 600: "#026DA6", 700: "#025685" } },
  emerald: { label: "Emerald", rgb: "13, 143, 82", ramp: { 50: "#E7FBEF", 100: "#B9F5D0", 300: "#4ADE80", 500: "#0D8F52", 600: "#0A7443", 700: "#075C36" } },
  amber: { label: "Amber", rgb: "232, 111, 0", ramp: { 50: "#FFF4E5", 100: "#FFE1B3", 300: "#FFB84D", 500: "#E86F00", 600: "#C55C00", 700: "#9E4A00" } },
  rose: { label: "Rose", rgb: "224, 40, 90", ramp: { 50: "#FFEDF2", 100: "#FFD1DE", 300: "#FB7BA0", 500: "#E0285A", 600: "#BE1E4B", 700: "#97173B" } },
} as const;

export type ThemeKey = keyof typeof THEME_PRESETS;

const STORAGE_KEY = "bimadesk:theme";

function applyTheme(key: ThemeKey) {
  const preset = THEME_PRESETS[key] ?? THEME_PRESETS.violet;
  const root = document.documentElement;
  root.style.setProperty("--accent-50", preset.ramp[50]);
  root.style.setProperty("--accent-100", preset.ramp[100]);
  root.style.setProperty("--accent-300", preset.ramp[300]);
  root.style.setProperty("--accent-500", preset.ramp[500]);
  root.style.setProperty("--accent-600", preset.ramp[600]);
  root.style.setProperty("--accent-700", preset.ramp[700]);
  root.style.setProperty("--accent-rgb", preset.rgb);
  root.setAttribute("data-theme", key);
}

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { organization, updateOrganization } = useAuth();

  const initial = useMemo<ThemeKey>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored && stored in THEME_PRESETS) return stored as ThemeKey;
    return "violet";
  }, []);

  const [theme, setThemeState] = useState<ThemeKey>(initial);

  // Once the organization's saved preference loads, prefer it.
  useEffect(() => {
    if (organization?.themeColor && organization.themeColor in THEME_PRESETS) {
      setThemeState(organization.themeColor as ThemeKey);
    }
  }, [organization?.themeColor]);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((key: ThemeKey) => {
    setThemeState(key);
    if (organization) {
      updateOrganization({ themeColor: key }).catch(() => {
        /* Local preference already applied; retry silently isn't critical here. */
      });
    }
  }, [organization, updateOrganization]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
