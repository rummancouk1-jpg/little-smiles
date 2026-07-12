// Derived read-time label — one implementation shared by the edit and
// publish flows so the label can never drift from the body it describes.

type SectionLike = { content: string[] };

/** ~200 wpm, floor 1 minute. */
export function computeReadTime(sections: SectionLike[]): string {
  const words = sections.reduce(
    (sum, section) =>
      sum +
      section.content.reduce(
        (s, paragraph) => s + paragraph.trim().split(/\s+/).filter(Boolean).length,
        0,
      ),
    0,
  );
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}
