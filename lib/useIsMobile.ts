"use client";

import { useEffect, useState } from "react";

// True when the viewport is at/below `bp` px. SSR-safe (false until mounted).
export function useIsMobile(bp = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [bp]);
  return isMobile;
}
