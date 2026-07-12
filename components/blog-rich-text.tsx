// Shared paragraph renderer for blog body copy (reader page AND the admin
// website preview — both must render identically so the preview stays
// honest).
//
// Supports exactly ONE markdown feature: internal links written as
// `[anchor text](/path)`. Rules:
//   - href must start with "/" (internal only — the SEO lever this exists
//     for). Anything else renders as plain text, silently de-linked.
//   - No nesting, no images, no bold/italics. Plain text stays plain.
//
// Server-safe: pure render, no client hooks.

import Link from "next/link";
import type { ReactNode } from "react";

const LINK_PATTERN = /\[([^\]\n]{1,120})\]\((\/[^\s)]*)\)/g;

/** True when the paragraph contains at least one internal markdown link. */
export function hasInternalLink(paragraph: string): boolean {
  LINK_PATTERN.lastIndex = 0;
  return LINK_PATTERN.test(paragraph);
}

/** Strip link syntax down to its anchor text (for word counts / previews). */
export function plainText(paragraph: string): string {
  return paragraph.replace(LINK_PATTERN, "$1");
}

export function RichParagraph({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  LINK_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const [full, anchor, href] = match;
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    nodes.push(
      <Link
        key={`link-${key++}`}
        href={href}
        className="font-medium text-ink-walnut underline decoration-ink-base/30 underline-offset-[3px] transition-colors hover:decoration-ink-walnut/60"
      >
        {anchor}
      </Link>,
    );
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <p className={className}>{nodes.length > 0 ? nodes : text}</p>;
}
