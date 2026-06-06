"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import type { Palette } from "./constants";
import { DARK, LIGHT } from "./constants";

type ThemeCtx = { D: Palette; toggle: () => void; isDark: boolean };
const ThemeContext = createContext<ThemeCtx>({ D: DARK, toggle: () => {}, isDark: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("qcl-theme");
    if (saved === "light") {
      setIsDark(false);
      document.documentElement.classList.add("light");
    }
  }, []);

  function toggle() {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.remove("light");
        localStorage.setItem("qcl-theme", "dark");
      } else {
        document.documentElement.classList.add("light");
        localStorage.setItem("qcl-theme", "light");
      }
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ D: isDark ? DARK : LIGHT, toggle, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}