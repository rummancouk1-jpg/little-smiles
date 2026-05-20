// Pinterest readiness validation. Pure deterministic function.
//
// Returns a small set of checks the operator must satisfy before
// publishing the pin to Pinterest. Each check carries a pass/fail
// + the actual measured value so the UI can show the precise reason.
//
// We deliberately don't enforce these in code (the operator can ship a
// pin that doesn't satisfy them all). The card surfaces them as calm
// editorial guidance, not blocking validation.

import type { BlogImage } from "@/lib/contentops/blog-schema";

export type PinterestCheckId =
  | "title_length"
  | "description_length"
  | "image_attached"
  | "image_aspect"
  | "image_alt_text"
  | "image_dimensions";

export type PinterestCheck = {
  id: PinterestCheckId;
  pass: boolean;
  label: string;
  detail: string;
};

const PINTEREST_TITLE_HARD_MAX = 100;
const PINTEREST_TITLE_RECOMMENDED_MAX = 95;
const PINTEREST_TITLE_MIN = 10;
const PINTEREST_DESCRIPTION_HARD_MAX = 500;
const PINTEREST_DESCRIPTION_MIN = 50;
const PINTEREST_MIN_WIDTH = 600;
const PINTEREST_MIN_HEIGHT = 900;
const PINTEREST_TARGET_ASPECT = 2 / 3;
const PINTEREST_ASPECT_TOLERANCE = 0.06; // ±6% from true 2:3

type Args = {
  title: string;
  description: string;
  image: BlogImage | null;
};

export type PinterestValidation = {
  checks: PinterestCheck[];
  /** True when every check passes. */
  ready: boolean;
  /** Count of failing checks — useful for the headline number. */
  failingCount: number;
};

function aspectRatio(image: BlogImage): number {
  if (image.height <= 0) return 0;
  return image.width / image.height;
}

export function validatePinterest(args: Args): PinterestValidation {
  const checks: PinterestCheck[] = [];

  // Title
  const titleLen = args.title.trim().length;
  checks.push({
    id: "title_length",
    pass:
      titleLen >= PINTEREST_TITLE_MIN && titleLen <= PINTEREST_TITLE_HARD_MAX,
    label: "Title length",
    detail:
      titleLen === 0
        ? "Title is empty."
        : titleLen > PINTEREST_TITLE_HARD_MAX
          ? `${titleLen} chars — Pinterest hard-caps at ${PINTEREST_TITLE_HARD_MAX}.`
          : titleLen > PINTEREST_TITLE_RECOMMENDED_MAX
            ? `${titleLen} chars — fits, but ≤${PINTEREST_TITLE_RECOMMENDED_MAX} reads better.`
            : titleLen < PINTEREST_TITLE_MIN
              ? `${titleLen} chars — too short to communicate the value.`
              : `${titleLen} chars.`,
  });

  // Description
  const descLen = args.description.trim().length;
  checks.push({
    id: "description_length",
    pass:
      descLen >= PINTEREST_DESCRIPTION_MIN &&
      descLen <= PINTEREST_DESCRIPTION_HARD_MAX,
    label: "Description length",
    detail:
      descLen === 0
        ? "Description is empty."
        : descLen > PINTEREST_DESCRIPTION_HARD_MAX
          ? `${descLen} chars — Pinterest hard-caps at ${PINTEREST_DESCRIPTION_HARD_MAX}.`
          : descLen < PINTEREST_DESCRIPTION_MIN
            ? `${descLen} chars — aim for at least ${PINTEREST_DESCRIPTION_MIN} for context.`
            : `${descLen} chars.`,
  });

  // Image attached
  const hasImage = Boolean(args.image);
  checks.push({
    id: "image_attached",
    pass: hasImage,
    label: "Image attached",
    detail: hasImage
      ? "Pin image present."
      : "Attach (or generate) a Pinterest pin image first.",
  });

  if (args.image) {
    const ratio = aspectRatio(args.image);
    const ratioPass =
      Math.abs(ratio - PINTEREST_TARGET_ASPECT) <= PINTEREST_ASPECT_TOLERANCE;
    checks.push({
      id: "image_aspect",
      pass: ratioPass,
      label: "Aspect ratio (2:3)",
      detail: ratioPass
        ? `${args.image.width}×${args.image.height} (≈ 2:3).`
        : `${args.image.width}×${args.image.height} — Pinterest favors a 2:3 vertical ratio.`,
    });

    const dimensionPass =
      args.image.width >= PINTEREST_MIN_WIDTH &&
      args.image.height >= PINTEREST_MIN_HEIGHT;
    checks.push({
      id: "image_dimensions",
      pass: dimensionPass,
      label: "Minimum dimensions",
      detail: dimensionPass
        ? `${args.image.width}×${args.image.height} clears the ${PINTEREST_MIN_WIDTH}×${PINTEREST_MIN_HEIGHT} minimum.`
        : `${args.image.width}×${args.image.height} — Pinterest recommends ≥ ${PINTEREST_MIN_WIDTH}×${PINTEREST_MIN_HEIGHT}.`,
    });

    const altLen = args.image.altText.trim().length;
    checks.push({
      id: "image_alt_text",
      pass: altLen > 0,
      label: "Alt text on the pin image",
      detail:
        altLen > 0
          ? `${altLen} characters.`
          : "Alt text is empty — accessibility-first signal.",
    });
  }

  const failing = checks.filter((c) => !c.pass);
  return {
    checks,
    ready: failing.length === 0 && hasImage,
    failingCount: failing.length,
  };
}
