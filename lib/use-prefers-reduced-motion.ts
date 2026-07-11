"use client";

import { useEffect, useState } from "react";

/**
 * Vanilla replacement for framer's `useReducedMotion` so the heroes can drop
 * framer-motion entirely (it was the dominant hydration/TBT cost). SSR-safe:
 * returns false until mounted, then tracks the media query.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduce;
}
