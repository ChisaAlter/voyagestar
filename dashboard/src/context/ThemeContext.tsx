import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  loadAppearanceOnBoot,
  writeStoredAppearance,
  type ThemePreference,
} from "../styles/appearanceStorage";
import {
  DEFAULT_PALETTE,
  customPaletteCssVars,
  normalizeHexColor,
  type ThemePalette,
} from "../styles/themePalettes";

export type { ThemePreference };

export type ThemeMode = "light" | "dark";

export type { ThemePalette };

interface ThemeContextValue {
  /** The resolved mode applied to the UI */
  mode: ThemeMode;
  /** The user's preference (may be "system") */
  preference: ThemePreference;
  /** Set preference */
  setPreference: (p: ThemePreference) => void;
  /** Brand color palette (orthogonal to light/dark) */
  palette: ThemePalette;
  /** Set brand palette */
  setPalette: (p: ThemePalette) => void;
  /** Brand hex for the "custom" palette */
  customColor: string;
  /** Set the custom brand hex (also switches palette to "custom") */
  setCustomColor: (hex: string) => void;
  /** Legacy toggle kept for backward compat (cycles light/dark) */
  toggle: () => void;
  /** Whether the current mode is considered "dark" for Ant Design */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  preference: "system",
  setPreference: () => {},
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  customColor: "",
  setCustomColor: () => {},
  toggle: () => {},
  isDark: false,
});

function resolveMode(pref: ThemePreference): ThemeMode {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  if (pref === "mist") return "light";
  if (pref === "starry") return "dark";
  return pref;
}

/**
 * Bundled theme preferences ("mist" / "starry") pin the amis palette while
 * active; the stored palette is preserved and restored on exit.
 */
export function isBundledPreference(pref: ThemePreference): boolean {
  return pref === "mist" || pref === "starry";
}

export function isDarkMode(mode: ThemeMode): boolean {
  return mode === "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = loadAppearanceOnBoot();
    document.documentElement.setAttribute(
      "data-palette",
      isBundledPreference(stored.preference) ? "amis" : stored.palette,
    );
    return stored.preference;
  });

  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    // loadAppearanceOnBoot is idempotent for the migrated JSON shape.
    return loadAppearanceOnBoot().palette;
  });

  const [customColor, setCustomColorState] = useState<string>(
    () => loadAppearanceOnBoot().customColor ?? "",
  );

  const [mode, setMode] = useState<ThemeMode>(() => resolveMode(preference));

  // Bundled themes override the stored palette with "amis" while active.
  const effectivePalette: ThemePalette = isBundledPreference(preference)
    ? "amis"
    : palette;

  // Listen for system color scheme changes when preference is "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (preference === "system") {
        setMode(mq.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  // Apply resolved mode when preference changes
  useEffect(() => {
    setMode(resolveMode(preference));
  }, [preference]);

  // Persist preference + palette together (mode is derived, not stored)
  useEffect(() => {
    writeStoredAppearance({ preference, palette, customColor });
    document.documentElement.setAttribute("data-palette", effectivePalette);
  }, [preference, palette, customColor, effectivePalette]);

  // Inject the runtime-derived CSS variables for the custom palette. The
  // style element is reused across renders; content updates on change.
  useEffect(() => {
    if (palette !== "custom") return;
    const el =
      document.getElementById("voyagestar-custom-palette") ??
      (() => {
        const node = document.createElement("style");
        node.id = "voyagestar-custom-palette";
        document.head.appendChild(node);
        return node;
      })();
    const normalized = normalizeHexColor(customColor);
    if (normalized) {
      el.textContent = `${customPaletteCssVars(
        normalized,
        mode === "dark",
      )}\n${customPaletteCssVars(normalized, mode !== "dark")}`;
    }
  }, [palette, customColor, mode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);

    // Keep the PWA theme-color meta tag in sync with the resolved mode so
    // the browser chrome (address bar, status bar, PWA title bar) matches.
    const themeColor =
      mode === "dark"
        ? effectivePalette === "amis"
          ? "#0a0e24"
          : "#1a1c28"
        : effectivePalette === "amis"
        ? "#fdf3f5"
        : "#ffffff";
    document
      .querySelectorAll<HTMLMetaElement>("meta[name='theme-color']")
      .forEach((el) => {
        el.content = themeColor;
      });
  }, [mode, effectivePalette]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
  }, []);

  const setPalette = useCallback((p: ThemePalette) => {
    setPaletteState(p);
    // Picking a brand palette exits a bundled theme, keeping its mode.
    setPreferenceState((prev) =>
      isBundledPreference(prev) ? resolveMode(prev) : prev,
    );
  }, []);

  const setCustomColor = useCallback((hex: string) => {
    const normalized = normalizeHexColor(hex);
    if (normalized) {
      setCustomColorState(normalized);
      setPaletteState("custom");
      setPreferenceState((prev) =>
        isBundledPreference(prev) ? resolveMode(prev) : prev,
      );
    }
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "light";
      if (prev === "mist") return "starry";
      if (prev === "starry") return "mist";
      return mode === "light" ? "dark" : "light";
    });
  }, [mode]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        preference,
        setPreference,
        palette: effectivePalette,
        setPalette,
        customColor,
        setCustomColor,
        toggle,
        isDark: isDarkMode(mode),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
