// Catalog of the SEO intelligence + ContentOps engines that ship with
// this build. Renders as the "Available intelligence modules" section
// of the client report so non-technical readers can see what's already
// running vs what's planned. Each entry is a stable description — the
// status flag is computed at render time from the live report.
//
// Keep this list as the single source of truth for "what does this
// system do?" — if you add a new engine, add a row here so the report
// stays honest.

export type ModuleStatus = "active" | "available" | "needs_data" | "manual";

export type ModuleCatalogEntry = {
  key: string;
  name: string;
  group: "Insights" | "ContentOps" | "Pipeline" | "Reporting";
  description: string;
};

export const MODULES: ModuleCatalogEntry[] = [
  {
    key: "seo_health_score",
    name: "SEO health score",
    group: "Insights",
    description: "Composite of 5 pillars (metadata, internal linking, schema, content decay, topic grouping). Every pillar shows its derivation.",
  },
  {
    key: "metadata_coverage",
    name: "Metadata coverage",
    group: "Insights",
    description: "Title / description length checks plus keywords[] sufficiency across blog and product pages.",
  },
  {
    key: "schema_coverage",
    name: "Schema.org coverage",
    group: "Insights",
    description: "Audits the data feeding lib/json-ld.ts. Sitewide schemas are emitted unconditionally; per-page coverage is verified.",
  },
  {
    key: "internal_linking",
    name: "Internal linking graph",
    group: "Insights",
    description: "Orphan + weak-link detection across the live blog + product graph; per-category cluster strength.",
  },
  {
    key: "link_suggestions",
    name: "Internal-link suggestions",
    group: "Insights",
    description: "Deterministic Jaccard overlap on blog keywords + same-category in-stock products. Ships with placement + ready-to-paste sentences.",
  },
  {
    key: "content_decay",
    name: "Content decay",
    group: "Insights",
    description: "Age + word count + section count + anchor product + image freshness. Traffic-decay signals once GSC + GA4 backlog deepens.",
  },
  {
    key: "topic_grouping",
    name: "Topic grouping",
    group: "Insights",
    description: "Deterministic Jaccard similarity on the keywords[] field — finds clusters and isolated posts.",
  },
  {
    key: "pinterest_readiness",
    name: "Pinterest readiness",
    group: "Insights",
    description: "Image dimensions read from /public via sharp. Pin verdict matches Pinterest's published 2:3 ratio guidance.",
  },
  {
    key: "content_calendar",
    name: "Content calendar",
    group: "Insights",
    description: "Future article ideas derived from weak product clusters, internal-link gaps, thin posts, and product CTA opportunities. No fake search volume.",
  },
  {
    key: "keyword_opportunities_v1",
    name: "Keyword opportunities (v1)",
    group: "Insights",
    description: "Keyword-shaped opportunities derived strictly from local data — clusters, content gaps, thin posts, internal-link gaps. Includes a copyable content brief per row. No external keyword volume, CPC, or difficulty is consulted.",
  },
  {
    key: "snapshot_insights",
    name: "GA4 + GSC snapshot insights",
    group: "Insights",
    description: "Latest snapshot rows turned into Top pages / Top queries / Low-CTR / Near page-one tables. Admin paths excluded from client-facing tables.",
  },
  {
    key: "snapshot_history",
    name: "Snapshot history (deltas)",
    group: "Insights",
    description: "Clicks / impressions / sessions / users deltas vs previous, 7d, and 30d snapshots.",
  },
  {
    key: "next_best_actions",
    name: "Next best actions",
    group: "Reporting",
    description: "Synthesises every engine into a prioritised, deterministic to-do list with effort + impact ratings.",
  },
  {
    key: "data_pipeline_health",
    name: "Data pipeline health",
    group: "Pipeline",
    description: "GA4 + GSC + Supabase reachability with per-provider failure code classification.",
  },
  {
    key: "draft_review_queue",
    name: "ContentOps queue",
    group: "ContentOps",
    description: "Pending / approved / rejected / published drafts with safety verdict, wife-friendly handoff labels, and deep-link to Improve.",
  },
  {
    key: "publish_safety_score",
    name: "Publish safety score",
    group: "ContentOps",
    description: "Per-draft Ready / Needs Review / Do Not Publish Yet verdict driven by ~10 deterministic checks.",
  },
  {
    key: "improve_draft",
    name: "Improve Draft assistant",
    group: "ContentOps",
    description: "Five-step plan, weakness explanations, suggested sections / FAQs / internal links / CTA, plus copy-to-clipboard briefs.",
  },
  {
    key: "image_prompts",
    name: "AI image prompt generator",
    group: "ContentOps",
    description: "Copy-ready prompts for blog hero, Pinterest 2:3, and product-support lifestyle imagery. No image generation runs by default.",
  },
  {
    key: "hero_image_workflow",
    name: "Hero image selection",
    group: "ContentOps",
    description: "Anchor product auto-resolve + per-draft override. Falls back gracefully when no product is in the category.",
  },
  {
    key: "blog_lifestyle_library",
    name: "Blog lifestyle image library",
    group: "ContentOps",
    description: "Admin-curated non-product hero candidates under public/uploads/blog/lifestyle/. Matched per draft by category + keywords + title terms, with a generic fallback bucket. No scraping, no AI generation.",
  },
  {
    key: "prepare_publish",
    name: "Prepare publish pipeline",
    group: "ContentOps",
    description: "Final-state checklist, conflict detection (slug collisions, malformed CTA), publication output preview. Manual publish only.",
  },
  {
    key: "admin_audit",
    name: "Admin audit log",
    group: "Reporting",
    description: "Records draft approvals, hero changes, brief copies, page-views of sensitive admin screens, and cron triggers. Viewable at /admin/audit.",
  },
];

/** Limitations honestly disclosed in the client report so expectations stay calibrated. */
export const KNOWN_BLIND_SPOTS: string[] = [
  "Keyword search volume — the system does not pull any external search-volume data. Priorities are derived from local catalog coverage + GSC snapshot rows when available, not from a third-party keyword tool.",
  "Competitor analysis — no external scraping; we never claim to know what competitors rank for.",
  "Backlink graph — no external backlink data source is wired up. Internal linking is fully covered; off-site linking is out of scope for v1.",
  "Real-time GA4 — GA4 standard reports lag 24-48h. The system shows the latest persisted snapshot; not a live feed.",
  "Live SERP positions — Search Console exposes 7-day-old average positions; live rank tracking would need a separate provider.",
  "AI-generated content — disabled by default. Even when enabled, the writer / image generator stays a manual per-draft action and never runs in the cron path.",
  "Auto-publish — every publish requires a human pressing the Prepare publish button. The system never publishes on its own.",
];
