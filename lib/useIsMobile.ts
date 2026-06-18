"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Single source of truth for the phone breakpoint (keep in sync with the
// `@media (max-width: 768px)` rules in app/globals.css).
export const MOBILE_BP = 768;

// Lets an embedded preview (the landing demo's phone frame) force the mobile
// layout for its subtree regardless of the real viewport. null = no override
// (default) → useIsMobile falls back to matchMedia exactly as before, so every
// existing consumer is unaffected.
export const MobileOverrideContext = createContext<boolean | null>(null);

// SSR-safe: defaults to false on the server / first paint, then reflects the
// real viewport after mount. Drives JS layout switches (drawer, NotePad stack,
// task cards) — CSS-only responsiveness should still use @media where possible.
export function useIsMobile(bp: number = MOBILE_BP): boolean {
  const override = useContext(MobileOverrideContext);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [bp]);
  return override !== null ? override : isMobile;
}
