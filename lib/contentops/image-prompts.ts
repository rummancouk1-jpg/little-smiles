// Image prompt generator for ContentOps drafts.
//
// Given a draft + (optionally) the anchor product, build three copy-ready
// prompts the operator can paste into any external image model. The
// prompts are deterministic: same draft + same anchor → same string.
//
// We never call an image model from here. AI image generation stays
// disabled unless the CONTENTOPS_IMAGE_GEN_ENABLED env flag is on, and
// even then it remains a manual, per-draft action — never automatic,
// never in the cron path.

import type { Draft } from "@/lib/contentops/drafts-store";

const BRAND_STYLE = [
  "Little Smiles brand style: soft, warm, premium ecommerce aesthetic.",
  "Natural daylight, calm cream-and-earth palette, gentle film grain.",
  "Baby- and parent-safe scene: no unsupervised infants, no choking hazards, no medical or clinical settings.",
  "Strict: no text overlays in the image, no watermarks, no logos, no faces of identifiable adults or children — show hands, fabrics, products, or scene only.",
  "Composition optimised for ecommerce — clean negative space, sharp focus on the subject, no harsh shadows.",
].join(" ");

const HERO_NEGATIVE = "Avoid: text, watermarks, logos, brand names, lens flare, neon colours, plastic-looking skin, identifiable faces.";

export type ImagePromptVariant = "hero" | "pinterest" | "lifestyle";

export type ImagePromptSet = {
  hero: string;
  pinterest: string;
  lifestyle: string;
  /** Surfaces whether the actual generator is reachable. Always false unless explicit env flags are on. */
  generationAvailable: boolean;
  generationDisabledReason: string | null;
};

function topicLine(draft: Draft): string {
  const title = draft.content.title.trim();
  const description = draft.content.description.trim();
  return `Article topic: "${title}". Editorial angle: "${description}".`;
}

function categoryLine(draft: Draft): string {
  const category = draft.content.relatedProductCategory;
  return `Product context: a parent-facing scene related to "${category}". Show the product type in use or as part of a calm daily routine.`;
}

function anchorProductLine(draft: Draft): string {
  if (!draft.hero_image_path) {
    return `Reference image: none selected — describe the product based on the category above.`;
  }
  return `Reference image (use as visual cue, do not replicate verbatim): ${draft.hero_image_path}`;
}

function buildHeroPrompt(draft: Draft): string {
  return [
    `Generate a blog HERO image (16:9 horizontal, ~1600×900).`,
    topicLine(draft),
    categoryLine(draft),
    anchorProductLine(draft),
    BRAND_STYLE,
    `Style direction: editorial lifestyle photography, slight depth-of-field, warm natural light from a window.`,
    HERO_NEGATIVE,
  ].join("\n\n");
}

function buildPinterestPrompt(draft: Draft): string {
  return [
    `Generate a Pinterest PIN image (vertical 2:3, ~1000×1500).`,
    topicLine(draft),
    categoryLine(draft),
    anchorProductLine(draft),
    BRAND_STYLE,
    `Style direction: tall vertical composition, subject placed in the upper two-thirds for thumbnail visibility, calm pastel backdrop, generous breathing room at the bottom (so a Pinterest title overlay could be added later by the operator — do not add the overlay yourself).`,
    HERO_NEGATIVE,
  ].join("\n\n");
}

function buildLifestylePrompt(draft: Draft): string {
  return [
    `Generate a PRODUCT-SUPPORT lifestyle image (square 1:1, ~1200×1200).`,
    topicLine(draft),
    categoryLine(draft),
    anchorProductLine(draft),
    BRAND_STYLE,
    `Style direction: close-up, soft styled flat-lay or in-use scene that shows the product in context (e.g. folded on a nursery surface, in a parent's hands, on a changing mat). Background neutral.`,
    HERO_NEGATIVE,
  ].join("\n\n");
}

export function buildDraftImagePrompts(draft: Draft): ImagePromptSet {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const enabled = hasKey && process.env.CONTENTOPS_IMAGE_GEN_ENABLED === "1";
  const disabledReason = enabled
    ? null
    : !hasKey
      ? "ANTHROPIC_API_KEY is not configured."
      : "Set CONTENTOPS_IMAGE_GEN_ENABLED=1 to enable assisted image generation.";

  return {
    hero: buildHeroPrompt(draft),
    pinterest: buildPinterestPrompt(draft),
    lifestyle: buildLifestylePrompt(draft),
    generationAvailable: enabled,
    generationDisabledReason: disabledReason,
  };
}
