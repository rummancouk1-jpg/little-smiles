// Pinterest intelligence — pure deterministic suggestions for Pinterest
// titles, descriptions, and pin-specific image prompts. No API calls.
//
// Pinterest's discovery model rewards:
//   - vertical 2:3 imagery
//   - calm, emotional, lifestyle composition
//   - benefit-led, scannable titles (≤ 100 chars, often closer to 60)
//   - descriptions that read like editorial captions and naturally
//     include the primary topic phrasing
//
// We bias the suggestions toward the brand's calm, editorial voice and
// never use clickbait punctuation, all-caps, emoji storms, or pseudo-
// scientific framing.

import type { BlogPost } from "@/lib/contentops/blog-schema";
import {
  clusterForCategory,
  type TopicalCluster,
} from "@/lib/contentops/intelligence/clusters";
import type { TopicSeasonality } from "@/lib/contentops/topics-store";

export type PinterestSeoSuggestion = {
  title: string;
  description: string;
  /** Image prompt biased for Pinterest discovery (2:3, lifestyle). */
  pinPrompt: string;
  /** 0..100 confidence the topic suits Pinterest at all. */
  suitabilityScore: number;
};

type PinterestArgs = {
  post: Pick<
    BlogPost,
    "title" | "description" | "category" | "relatedProductCategory" | "keywords"
  >;
  seasonality?: TopicSeasonality | null;
  /** From visual-style-intelligence so the two modules agree. */
  suitabilityScore?: number;
};

const TITLE_MAX = 95; // safe under Pinterest's 100-char cap
const DESCRIPTION_MAX = 460; // safe under Pinterest's 500-char cap

// Cluster-specific lifestyle scene the pin should depict.
const PIN_SCENE: Record<TopicalCluster, string> = {
  Sleep:
    "calm mother gently laying a swaddled newborn into a softly-lit bassinet, dusk window light",
  Feeding:
    "mother seated by a window with baby resting on a feeding cushion, warm afternoon glow",
  Wardrobe:
    "neatly folded muslin bodysuits and a baby's hand reaching across a linen surface",
  Outings:
    "parent walking through a leafy street with a baby in a soft carrier, warm morning light",
  Gifting:
    "thoughtful curated baby-gift flat-lay on a cream linen surface with dried florals",
  "Newborn Care":
    "soft nursery corner with a small basket of essentials, gentle natural light",
};

const SEASONAL_LAYER: Partial<Record<TopicSeasonality, string>> = {
  summer: "lightweight cotton, breezy white curtain, soft summer light",
  winter: "warm knit textures, soft camel tones, afternoon golden light",
  monsoon: "indoor cozy framing, rain softly visible through a window",
  eid: "subtle festive styling — a single hand-stitched detail, marigold accent",
};

const BASE_DIRECTION = [
  "realistic editorial photography",
  "vertical 2:3 composition optimized for Pinterest discovery",
  "premium boutique baby-brand aesthetic",
  "soft pastel palette",
  "shallow depth of field",
  "no text overlays",
  "no logos",
  "no watermarks",
].join(", ");

const NEGATIVES = [
  "no clickbait styling",
  "no neon colors",
  "no all-caps imagery",
  "no plastic-looking babies",
  "no AI uncanny faces",
  "no oversaturated colors",
  "no clutter",
].join(", ");

// ---------------------------------------------------------------------------
// Title composer
// ---------------------------------------------------------------------------

// Pinterest titles do well with calm benefit framing. We don't try to be
// clever — we lift the operator's title and gently shorten / soften it.
function composeTitle(post: PinterestArgs["post"]): string {
  const raw = post.title.trim();
  if (raw.length <= TITLE_MAX) return raw;
  // Find the last sentence break / colon under the cap to preserve voice.
  const trimmed = raw.slice(0, TITLE_MAX);
  const lastBreak = Math.max(
    trimmed.lastIndexOf(": "),
    trimmed.lastIndexOf(" — "),
    trimmed.lastIndexOf(" - "),
    trimmed.lastIndexOf(". "),
  );
  if (lastBreak > 30) return trimmed.slice(0, lastBreak);
  // Otherwise hard-cut at the last space, no ellipsis.
  const lastSpace = trimmed.lastIndexOf(" ");
  return trimmed.slice(0, lastSpace > 30 ? lastSpace : TITLE_MAX);
}

// Description: editorial caption + soft CTA hint, always benefit-led.
function composeDescription(post: PinterestArgs["post"]): string {
  const keyword = post.keywords[0]?.trim() ?? "";
  const base = post.description.trim();
  const closing =
    keyword.length > 0
      ? `A calm editorial guide on ${keyword.toLowerCase()} from Little Smiles.`
      : "A calm editorial guide from Little Smiles.";
  const composed = base.endsWith(".") ? `${base} ${closing}` : `${base}. ${closing}`;
  if (composed.length <= DESCRIPTION_MAX) return composed;
  return `${composed.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

function composePinPrompt(args: PinterestArgs): string {
  const cluster = clusterForCategory(args.post.relatedProductCategory);
  const scene = PIN_SCENE[cluster];
  const seasonal = args.seasonality ? SEASONAL_LAYER[args.seasonality] ?? "" : "";
  const parts = [
    `Pinterest pin (2:3) for "${args.post.title}"`,
    scene,
    seasonal,
    BASE_DIRECTION,
    NEGATIVES,
  ].filter((s) => s && s.trim().length > 0);
  return parts.join(", ");
}

export function composePinterestSeo(args: PinterestArgs): PinterestSeoSuggestion {
  return {
    title: composeTitle(args.post),
    description: composeDescription(args.post),
    pinPrompt: composePinPrompt(args),
    // Trust caller's score if provided; otherwise a flat 70 default
    // (Pinterest is suitable for almost any lifestyle topic).
    suitabilityScore: typeof args.suitabilityScore === "number"
      ? Math.max(0, Math.min(100, Math.round(args.suitabilityScore)))
      : 70,
  };
}
