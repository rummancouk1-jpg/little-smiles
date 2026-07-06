"use client";

import {
  createElement,
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * One consistent scroll-reveal used across the site: a soft fade + short rise
 * as the element enters the viewport, once, then it stays. Presentation only.
 *
 * Safety model (non-negotiable): content is server-rendered fully VISIBLE. The
 * hidden state (`.reveal-armed`) is applied by this effect ONLY after we've
 * confirmed the browser can observe and the visitor hasn't asked for reduced
 * motion. So if JS never runs, the observer is unsupported, or motion is
 * reduced, the content is simply shown — the reveal is a pure enhancement and
 * never gates readability. Above-the-fold elements are never armed (no flash).
 */

const STAGGER_STEP_MS = 70;
const STAGGER_MAX_STEPS = 6; // cap so long lists don't trail on forever

type RevealProps = {
  /** Element to render (default div). Use "article"/"li" to slot into grids. */
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** Position within a group — drives the gentle stagger. */
  index?: number;
  style?: CSSProperties;
};

export function Reveal({
  as: Tag = "div",
  children,
  className,
  index = 0,
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Enhancement only: bail (leave visible) when we can't observe or the
    // visitor prefers reduced motion.
    if (
      typeof IntersectionObserver !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Already on screen at load → don't hide, don't animate (no flash).
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    el.classList.add("reveal-armed");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-revealed");
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const delay = Math.min(index, STAGGER_MAX_STEPS) * STAGGER_STEP_MS;
  const mergedStyle = (
    delay ? { ...style, "--reveal-delay": `${delay}ms` } : style
  ) as CSSProperties | undefined;

  return createElement(
    Tag,
    {
      ref,
      "data-reveal": "",
      className,
      style: mergedStyle,
    },
    children,
  );
}
