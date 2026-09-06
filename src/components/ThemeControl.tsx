"use client";
import { useTheme } from "./ThemeProvider";
export function ThemeControl() { const { theme, setTheme } = useTheme(); return <label className="theme-control"><span className="sr-only">Theme</span><select aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as "dark" | "light" | "system")}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>; }
