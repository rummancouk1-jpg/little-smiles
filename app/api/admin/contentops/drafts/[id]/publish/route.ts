import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { logAdminAudit } from "@/lib/admin-audit";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { littleSmilesPublishAdapter } from "@/lib/blog-publish-adapter";
import { getDraftById, markDraftPublished } from "@/lib/contentops/drafts-store";
import { preparePublish } from "@/lib/contentops/publish-prep";
import { computeReadTime } from "@/lib/contentops/read-time";
import { captureServerError } from "@/lib/error-observability";

type RouteProps = {
  params: Promise<{ id: string }>;
};

/** Publish day in Pakistan time — the date readers, JSON-LD and the sitemap all see. */
function todayInKarachi(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * One-click publish (C1 fix). The human gate is UNCHANGED — only drafts a
 * reviewer explicitly approved reach this route, and the same publish-prep
 * report that powered the manual flow re-runs server-side as a final gate:
 * any error-severity conflict refuses the publish.
 */
export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const draft = await getDraftById(id);
    if (!draft) {
      return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
    }
    if (draft.status !== "approved") {
      return NextResponse.json(
        { ok: false, error: `Only approved drafts can be published (draft is ${draft.status}).` },
        { status: 409 },
      );
    }

    // Final server-side gate — same checks the reviewer saw on screen.
    const preparation = await preparePublish(draft, littleSmilesPublishAdapter);
    if (!preparation.ready) {
      const blocking = preparation.conflicts.filter((c) => c.severity === "error");
      return NextResponse.json(
        {
          ok: false,
          error: "Publish blocked by unresolved conflicts.",
          conflicts: blocking.map((c) => ({ code: c.code, message: c.message })),
        },
        { status: 409 },
      );
    }

    // The record the public blog serves: hero override merged (adapter),
    // publish date stamped to today (PKT), read time recomputed.
    const content = {
      ...preparation.insertionPreview,
      publishedAt: todayInKarachi(),
      readTime: computeReadTime(preparation.insertionPreview.sections),
    };

    const published = await markDraftPublished(draft.id, content);

    // The post is served from the DB — refresh every surface that lists it.
    revalidatePath("/blog");
    revalidatePath(`/blog/${published.slug}`);
    revalidatePath("/");
    revalidatePath("/sitemap.xml");

    await logAdminAudit(request, {
      action: "contentops_draft_publish",
      targetType: "contentops_draft",
      targetId: published.id,
      metadata: { slug: published.slug, publishedAt: content.publishedAt },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      draft: published,
      url: `/blog/${published.slug}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish draft";
    captureServerError(
      "api_admin_contentops_publish_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
