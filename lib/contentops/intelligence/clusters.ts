// Topical-cluster mapping. Maps the article's anchor product category
// to a higher-level editorial cluster. Both the relationships engine
// (P2) and the topic intelligence (P3) consume this so we get coherent
// topical authority signals without storing the cluster on every row.
//
// Pure deterministic mapping — no DB hit, no AI call. Add new clusters
// here as the catalog grows; nothing else needs to know about the change.

import type { BlogRelatedProductCategory } from "@/lib/contentops/blog-schema";

export type TopicalCluster =
  | "Sleep"
  | "Feeding"
  | "Wardrobe"
  | "Outings"
  | "Gifting"
  | "Newborn Care";

export const TOPICAL_CLUSTERS: TopicalCluster[] = [
  "Sleep",
  "Feeding",
  "Wardrobe",
  "Outings",
  "Gifting",
  "Newborn Care",
];

const CATEGORY_TO_CLUSTER: Record<BlogRelatedProductCategory, TopicalCluster> = {
  Swaddle: "Sleep",
  Bodysuits: "Wardrobe",
  "Food Bag": "Outings",
  "Bottle Case": "Outings",
  "Feeding Cushion": "Feeding",
  "Food Container": "Feeding",
  "Bow Set": "Gifting",
};

export function clusterForCategory(category: BlogRelatedProductCategory): TopicalCluster {
  return CATEGORY_TO_CLUSTER[category];
}

export function isTopicalCluster(value: string): value is TopicalCluster {
  return (TOPICAL_CLUSTERS as string[]).includes(value);
}
