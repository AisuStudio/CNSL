"use client";

import { useEffect } from "react";

// Applies the mono theme to <html> for standalone public pages (published
// articles, legal/info pages). The inline script in app/layout.tsx already sets
// it before first paint on a hard load (no FOUC); this handles client-side (SPA)
// navigation — e.g. the landing footer Links to /impressum — where that script
// doesn't re-run and the previous route may have removed the attribute on unmount.
// Honours ?hue (override the mono hue), and cleans up on unmount so it doesn't
// leak into other routes. (Mono is the only theme — the old "classic" palette
// is retired.)
export default function MonoTheme() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const root = document.documentElement;
    root.setAttribute("data-theme", "mono");
    const hue = params.get("hue");
    if (hue) root.style.setProperty("--mono", hue);
    return () => {
      root.removeAttribute("data-theme");
      root.style.removeProperty("--mono");
    };
  }, []);
  return null;
}
