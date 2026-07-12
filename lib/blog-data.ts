// Unified blog data source (C1 fix): the public blog reads STATIC seed
// posts from lib/blog.ts PLUS admin-published posts from Supabase
// (contentops_drafts, status = "published"). Publishing is an admin
// action — no lib/blog.ts edit, no deploy.
//
// Server-only: imports the Supabase ADMIN client. Never import from a
// client component.
//
// Failure posture: if Supabase is unreachable or unconfigured (e.g. a
// local build without env), the blog gracefully serves the static seed
// posts — a database outage can never take the whole journal down.

import { blogPosts as staticBlogPosts, type BlogPost } from "@/lib/blog";
import { blogPostSchema } from "@/lib/contentops/blog-schema";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type PublishedDraftRow = {
  slug: string;
  content: unknown;
  hero_image_path: string | null;
};

function rowToPost(row: PublishedDraftRow): BlogPost | null {
  const parsed = blogPostSchema.safeParse(row.content);
  if (!parsed.success) {
    console.error(
      `[blog-data] published draft "${row.slug}" failed schema validation — skipped.`,
    );
    return null;
  }
  const override = row.hero_image_path?.trim();
  return override && override.length > 0 && !parsed.data.heroImage
    ? { ...parsed.data, heroImage: override }
    : parsed.data;
}

/** All admin-published posts, newest first. Empty on any failure. */
export async function getPublishedDraftPosts(): Promise<BlogPost[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("slug, content, hero_image_path")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error || !data) {
    if (error) console.error(`[blog-data] failed to load published drafts: ${error.message}`);
    return [];
  }
  return (data as PublishedDraftRow[])
    .map(rowToPost)
    .filter((post): post is BlogPost => post !== null);
}

/**
 * Every live post: static seed posts + admin-published posts, newest
 * first. Static wins slug collisions (the publish conflict gate should
 * prevent them; if one slips through, the older live page stays stable).
 */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const published = await getPublishedDraftPosts();
  const staticSlugs = new Set(staticBlogPosts.map((post) => post.slug));
  const merged = [
    ...staticBlogPosts,
    ...published.filter((post) => !staticSlugs.has(post.slug)),
  ];
  return merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Single-post lookup across both sources (static first — no query needed). */
export async function getAnyBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const staticPost = staticBlogPosts.find((post) => post.slug === slug);
  if (staticPost) return staticPost;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("slug, content, hero_image_path")
    .eq("status", "published")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToPost(data as PublishedDraftRow);
}
