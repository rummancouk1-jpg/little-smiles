// Image SEO + accessibility composer. Pure deterministic module.
//
// Produces:
//   - alt text       Accessibility-first; describes the visible scene
//                    using the article's editorial vocabulary. No
//                    keyword stuffing.
//   - caption        Optional one-line italic that supports the article
//                    flow rather than narrating the obvious.
//   - og description Social-card description tuned to the slot.
//   - semantic       Plain-English summary used by the analytics card
//                    when surfacing image health.
//
// Inputs are bounded: title + cluster + primary keyword + slot. We
// never embed the SEO keyword bag wholesale — alt text exists for
// accessibility, not crawler manipulation.

import type {
  BlogImageSlot,
  BlogPost,
} from "@/lib/contentops/blog-schema";
import {
  clusterForCategory,
  type TopicalCluster,
} from "@/lib/contentops/intelligence/clusters";

export type ImageSeoSuggestion = {
  altText: string;
  caption: string | null;
  ogDescription: string;
  semanticSummary: string;
};

type SeoArgs = {
  post: Pick<
    BlogPost,
    "title" | "description" | "category" | "relatedProductCategory" | "keywords"
  >;
  slot: BlogImageSlot;
};

// ---------------------------------------------------------------------------
// Per-cluster scene noun. Used as the spine of the alt text so it stays
// honest to what the image will actually contain.
// ---------------------------------------------------------------------------

const CLUSTER_SCENE_NOUN: Record<TopicalCluster, string> = {
  Sleep: "a newborn resting in a soft swaddle, calm window light nearby",
  Feeding: "a parent and baby in a calm feeding moment, soft daylight",
  Wardrobe: "a soft cotton bodysuit laid on a linen surface",
  Outings: "a neutral-toned parent bag set on a wooden surface",
  Gifting: "a curated flat-lay of small baby items in soft pastel tones",
  "Newborn Care": "a calm nursery corner with neutral textures",
};

const SLOT_QUALIFIER: Record<BlogImageSlot, string> = {
  hero: "as the editorial hero for",
  thumbnail: "as the card image for",
  og: "as the social-card image for",
  pinterest: "as the Pinterest pin image for",
};

// ---------------------------------------------------------------------------
// Primary keyword resolution — first non-empty, lowercase-comparable
// trim. Stays loyal to the operator's own copy.
// ---------------------------------------------------------------------------

function primaryKeyword(post: SeoArgs["post"]): string {
  const first = post.keywords.find((k) => k && k.trim().length > 0);
  return (first ?? post.title).trim();
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export function composeImageSeo(args: SeoArgs): ImageSeoSuggestion {
  const cluster = clusterForCategory(args.post.relatedProductCategory);
  const scene = CLUSTER_SCENE_NOUN[cluster];
  const keyword = primaryKeyword(args.post);
  const qualifier = SLOT_QUALIFIER[args.slot];

  // Alt text — descriptive, accessibility-first, length-bounded.
  const altText = truncate(
    `${capitalize(scene)} — illustrating ${keyword} ${qualifier} the article "${args.post.title}".`,
    400,
  );

  // Caption — optional, only meaningful on hero/section slots.
  const caption =
    args.slot === "hero"
      ? truncate(`A calm visual cue for ${keyword.toLowerCase()}.`, 200)
      : null;

  // OG description — readable social-card line.
  const ogDescription = truncate(
    `${args.post.description} A premium editorial guide from Little Smiles.`,
    280,
  );

  // Semantic summary — analytics surfaces consume this; no keywords.
  const semanticSummary = `${capitalize(args.slot)} image in the ${cluster} cluster. Scene: ${scene}.`;

  return {
    altText,
    caption,
    ogDescription,
    semanticSummary,
  };
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

function capitalize(input: string): string {
  if (input.length === 0) return input;
  return input[0].toUpperCase() + input.slice(1);
}
