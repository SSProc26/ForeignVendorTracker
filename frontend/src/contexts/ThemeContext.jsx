import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { THEME_KEY, THEMES } from "@/lib/constants";
import { api } from "@/lib/api";

const ThemeCtx = createContext(null);

function apply(themeId) {
  document.documentElement.setAttribute("data-theme", themeId);
  document.body.setAttribute("data-theme", themeId);
}

export function ThemeProvider({ children, initial }) {
  const [theme, setTheme] = useState(() => initial || localStorage.getItem(THEME_KEY) || "steel");

  useEffect(() => {
    apply(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setThemePersist = useCallback(async (id) => {
    if (!THEMES.find((t) => t.id === id)) return;
    setTheme(id);
    try { await api.post("/settings/theme", { theme: id }); } catch { /* offline ok */ }
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme: setThemePersist, themes: THEMES }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
