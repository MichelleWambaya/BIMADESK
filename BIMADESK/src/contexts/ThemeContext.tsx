import React, { createContext, useContext, useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
}

const STORAGE_KEY = "bimadesk_theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(preference === "dark" ? "dark" : preference === "light" ? "light" : systemPrefersDark() ? "dark" : "light");

  useEffect(() => {
    function apply() {
      const resolved = preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
      setResolvedTheme(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
    }
    apply();

    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  function setPreference(p: ThemePreference) {
    localStorage.setItem(STORAGE_KEY, p);
    setPreferenceState(p);
  }

  return <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
