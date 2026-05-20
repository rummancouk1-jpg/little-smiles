// Media strategy module. Pure deterministic — combines the SERP and
// visual-style intelligences into a per-slot recommendation:
//   - which slots should be filled
//   - which sections deserve an image
//   - whether a Pinterest asset is worth producing
//   - whether an OG card is worth a dedicated render
//
// Output is calm and actionable: one entry per recommended action,
// each carrying a single-line rationale. The operator-facing card
// renders them as a checklist.

import type {
  BlogImageSlot,
  BlogPost,
} from "@/lib/contentops/blog-schema";
import { inferSerpIntelligence } from "@/lib/contentops/intelligence/serp-intelligence";
import { inferVisualStyle } from "@/lib/contentops/intelligence/visual-style-intelligence";
import type {
  TopicFormat,
  TopicIntent,
  TopicSeasonality,
} from "@/lib/contentops/topics-store";

export type MediaActionStatus = "satisfied" | "recommended" | "optional";

export type MediaAction = {
  slot: BlogImageSlot | "section";
  /** When slot === "section", this is the section index (0-based). */
  sectionIndex?: number;
  status: MediaActionStatus;
  /** Operator-facing rationale; one calm line. */
  rationale: string;
};

export type MediaStrategy = {
  actions: MediaAction[];
  pinterestRecommended: boolean;
  ogRecommended: boolean;
};

type Args = {
  post: BlogPost;
  format?: TopicFormat | null;
  intent?: TopicIntent | null;
  seasonality?: TopicSeasonality | null;
};

export function inferMediaStrategy(args: Args): MediaStrategy {
  const serp = inferSerpIntelligence({
    post: args.post,
    format: args.format,
    intent: args.intent,
    seasonality: args.seasonality,
  });
  const style = inferVisualStyle({
    post: args.post,
    format: args.format,
    intent: args.intent,
    seasonality: args.seasonality,
  });

  const actions: MediaAction[] = [];

  // Hero — always recommended.
  actions.push({
    slot: "hero",
    status: args.post.hero ? "satisfied" : "recommended",
    rationale: args.post.hero
      ? "Hero image attached."
      : "Articles without a hero look unfinished and underperform on cards.",
  });

  // Thumbnail — useful when hero aspect is non-square (which is always here).
  actions.push({
    slot: "thumbnail",
    status: args.post.thumbnail ? "satisfied" : "optional",
    rationale: args.post.thumbnail
      ? "Dedicated thumbnail attached."
      : "Optional — falls back to hero on cards if absent.",
  });

  // OG — recommended when the article has commercial intent or a strong
  // social-share story; otherwise optional.
  const ogRecommended =
    serp.detectedIntent === "commercial" ||
    serp.detectedIntent === "comparison" ||
    Boolean(args.post.pinterestSeo);
  actions.push({
    slot: "og",
    status: args.post.og
      ? "satisfied"
      : ogRecommended
        ? "recommended"
        : "optional",
    rationale: args.post.og
      ? "Dedicated OG card attached."
      : ogRecommended
        ? "Dedicated OG card helps CTR on social and Slack previews."
        : "Optional — the hero already serves as a social fallback.",
  });

  // Pinterest — driven by visual-style suitability score.
  const pinterestRecommended = style.pinterestSuitability >= 75;
  actions.push({
    slot: "pinterest",
    status: args.post.pinterest
      ? "satisfied"
      : pinterestRecommended
        ? "recommended"
        : "optional",
    rationale: args.post.pinterest
      ? "Pinterest pin attached."
      : pinterestRecommended
        ? "Strong Pinterest fit — a 2:3 pin is the highest-leverage discovery asset for this topic."
        : "Pinterest fit is moderate — proceed only if you have a clean visual idea.",
  });

  // Section images — recommended count comes from SERP intel; cap by
  // the actual section count.
  const sectionTarget = Math.min(
    serp.recommendedImages.sections,
    args.post.sections.length,
  );
  for (let i = 0; i < sectionTarget; i++) {
    const present = Boolean(args.post.sections[i]?.image);
    actions.push({
      slot: "section",
      sectionIndex: i,
      status: present ? "satisfied" : "recommended",
      rationale: present
        ? `Section ${i + 1}: image attached.`
        : `Section ${i + 1}: a calm supporting visual would strengthen this section.`,
    });
  }

  return {
    actions,
    pinterestRecommended,
    ogRecommended,
  };
}
