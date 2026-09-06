export type ThemePreference = "dark" | "light" | "system";
export const THEME_STORAGE_KEY = "veyrix.theme.v1";
export const DEFAULT_THEME: ThemePreference = "dark";
export function isThemePreference(value: unknown): value is ThemePreference { return value === "dark" || value === "light" || value === "system"; }
export function resolveTheme(theme: ThemePreference, prefersDark: boolean) { return theme === "system" ? (prefersDark ? "dark" : "light") : theme; }
