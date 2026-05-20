// Deterministic image-prompt composer. Pure function: given a BlogPost's
// editorial metadata, produce three calm, premium, editorial-quality
// prompts for hero / thumbnail / OG image surfaces.
//
// Design intent: prompts must read like an art director's brief, not a
// keyword bag. We curate a small vocabulary of "house style" cues
// (natural light, soft pastels, candid moment, no text, no logo) and
// compose them with topic-specific framing so every prompt feels of-a-
// piece with Little Smiles' editorial voice.
//
// No AI call. No provider coupling. Phase 2 will pass these prompts to
// a real image generator behind the adapter in image-providers/.

import type { BlogPost } from "@/lib/contentops/blog-schema";

const PALETTE_VERSION = "ls-editorial-1";

// Base art-direction line shared by every prompt. Encodes the
// anti-AI-look and anti-text guardrails so each surface inherits them
// without repetition.
const BASE_DIRECTION = [
  "Realistic editorial photography",
  "soft natural daylight from a window",
  "warm pastel palette — cream, dusty rose, sage, warm beige",
  "shallow depth of field",
  "candid unposed moment",
  "premium boutique baby-brand aesthetic",
  "no text",
  "no logos",
  "no watermarks",
  "no captions",
].join(", ");

const NEGATIVES = [
  "no cartoon style",
  "no 3D render",
  "no AI-looking babies",
  "no plastic skin",
  "no extra fingers",
  "no oversaturated colors",
  "no clutter",
  "no busy backgrounds",
  "no stock-photo feel",
].join(", ");

// Maps the article's anchor product category to a concrete scene
// vocabulary so the composer can suggest realistic, on-brand imagery
// without leaking SKU names.
const CATEGORY_SCENE: Record<string, string> = {
  Swaddle:
    "newborn lightly wrapped in a breathable muslin swaddle, mother's hand resting gently",
  Bodysuits:
    "newborn in a soft cotton bodysuit on a linen sheet, folded basics in soft focus behind",
  "Food Bag":
    "a neutral-toned insulated food bag on a wooden table beside a small flask, midday window light",
  "Bottle Case":
    "a baby bottle nestled inside a quilted carry case on a stroller seat, parent hand in soft focus",
  "Feeding Cushion":
    "mother seated by a window with a calm feeding cushion supporting the baby, golden hour glow",
  "Bow Set":
    "a tidy flat-lay of two delicate hair bows on a cream linen background, dried florals as accents",
  "Food Container":
    "a small leak-proof container on a kitchen counter beside fresh fruit, soft morning light",
};

// Seasonal cues tie back to what reads as "Pakistan-aware" without
// being heavy-handed about location. The composer adds these only when
// a seasonality signal exists.
const SEASONAL_CUE: Record<string, string> = {
  summer:
    "lightweight breathable cotton or muslin, summer morning light, soft pastel cream tones",
  winter:
    "soft knit layers, warm afternoon light, gentle ochre and sage accents",
  monsoon:
    "indoor scene, gentle rain visible softly through a window, cozy quilted textures",
  eid:
    "subtle festive styling — a single hand-stitched detail, fresh marigolds in soft focus, warm celebratory light",
  evergreen: "",
};

type PromptablePost = Pick<
  BlogPost,
  "title" | "description" | "category" | "relatedProductCategory" | "keywords"
>;

// Mild Pakistan/South Asia framing applied when the title or keywords
// reference local context. Kept gentle so the prompt doesn't read as
// stock "ethnic" framing.
function pakistanCue(post: PromptablePost): string {
  const haystack = [
    post.title,
    post.description,
    ...post.keywords,
  ]
    .join(" ")
    .toLowerCase();
  const refs = [
    "pakistan",
    "karachi",
    "lahore",
    "islamabad",
    "desi",
    "south asia",
    "south-asian",
    "south asian",
    "urdu",
  ];
  const hit = refs.some((r) => haystack.includes(r));
  if (!hit) return "";
  return "south-asian family setting, soft hand-loomed textiles in the background";
}

function primaryKeyword(post: PromptablePost): string {
  const first = post.keywords.find((k) => k && k.trim().length > 0);
  return (first ?? post.title).trim();
}

function joinParts(parts: Array<string | undefined | null>): string {
  return parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0)
    .join(", ");
}

type PromptArgs = {
  post: PromptablePost;
  /**
   * Optional seasonality cue from the originating topic. When absent,
   * the composer keeps the prompt season-neutral.
   */
  seasonality?: keyof typeof SEASONAL_CUE | null;
};

/**
 * Compose hero / thumbnail / OG / pinterest prompts for a draft.
 * Output is deterministic given the same input — useful for tests and
 * for the regenerate-with-different-season UX a future phase may add.
 *
 * Phase 5: also emits a Pinterest 2:3 prompt biased for lifestyle
 * discovery. The Pinterest intelligence layer can override this with
 * a richer scene if needed; the prompt here is a safe baseline.
 */
export function composeImagePrompts(args: PromptArgs): {
  hero: string;
  thumbnail: string;
  og: string;
  pinterest: string;
  generatedAt: string;
  paletteVersion: string;
} {
  const { post } = args;
  const keyword = primaryKeyword(post);
  const scene = CATEGORY_SCENE[post.relatedProductCategory] ?? "";
  const seasonal = args.seasonality ? SEASONAL_CUE[args.seasonality] ?? "" : "";
  const pakistan = pakistanCue(post);

  const editorialFraming = `Editorial article hero for "${post.title}"`;
  const thumbFraming = `Square thumbnail for an article about ${keyword}`;
  const ogFraming = `Social-card image (1200x630) representing "${post.title}"`;
  const pinFraming = `Pinterest pin (2:3, vertical) for "${post.title}"`;

  const hero = joinParts([
    editorialFraming,
    scene,
    seasonal,
    pakistan,
    "wide composition with breathing room on one side for layout",
    BASE_DIRECTION,
    NEGATIVES,
  ]);

  const thumbnail = joinParts([
    thumbFraming,
    scene,
    seasonal,
    pakistan,
    "tight square composition, single clear subject",
    BASE_DIRECTION,
    NEGATIVES,
  ]);

  const og = joinParts([
    ogFraming,
    scene,
    seasonal,
    pakistan,
    "centered horizontal composition with clear focal subject, gentle vignette",
    BASE_DIRECTION,
    NEGATIVES,
  ]);

  const pinterest = joinParts([
    pinFraming,
    scene,
    seasonal,
    pakistan,
    "vertical 2:3 composition optimized for Pinterest discovery",
    "warm parent-and-baby lifestyle framing where appropriate",
    "premium motherhood aesthetic, calm emotional warmth",
    BASE_DIRECTION,
    NEGATIVES,
  ]);

  return {
    hero,
    thumbnail,
    og,
    pinterest,
    generatedAt: new Date().toISOString(),
    paletteVersion: PALETTE_VERSION,
  };
}
