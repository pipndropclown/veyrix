"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, isThemePreference, resolveTheme, type ThemePreference } from "@/lib/theme/theme";
const ThemeContext = createContext<{ theme: ThemePreference; setTheme: (theme: ThemePreference) => void }>({ theme: DEFAULT_THEME, setTheme: () => {} });
export function useTheme() { return useContext(ThemeContext); }
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY); return isThemePreference(stored) ? stored : DEFAULT_THEME;
  });
  const [mounted] = useState(true);
  useEffect(() => {
    if (!mounted) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.dataset.theme = resolveTheme(theme, media.matches);
    apply(); media.addEventListener?.("change", apply); return () => media.removeEventListener?.("change", apply);
  }, [theme, mounted]);
  const setTheme = (value: ThemePreference) => { setThemeState(value); localStorage.setItem(THEME_STORAGE_KEY, value); };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
