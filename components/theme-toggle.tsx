"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Manual light/dark toggle. The initial theme is set before paint by the
 * inline script in the root layout (reads localStorage, else the device's
 * prefers-color-scheme), so there's no flash. Clicking flips the `dark`
 * class on <html> and persists the explicit choice to localStorage.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable (private mode) — theme still applies for the session */
    }
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        mounted
          ? isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
          : "Toggle color theme"
      }
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-full border border-ink-base/14 bg-surface-raised/66 text-ink-walnut shadow-[0_10px_28px_-22px_rgba(59,47,47,0.46)] backdrop-blur-sm transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink-base/26 hover:bg-surface-hover",
        className,
      )}
    >
      {/* Show the icon for the mode you'll switch TO. Placeholder (Moon) pre-mount. */}
      {mounted && isDark ? (
        <Sun className="size-[1.15rem]" strokeWidth={1.9} aria-hidden />
      ) : (
        <Moon className="size-[1.1rem]" strokeWidth={1.9} aria-hidden />
      )}
    </button>
  );
}
