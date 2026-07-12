import { NextResponse } from "next/server";

import { logAdminAudit } from "@/lib/admin-audit";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { blogPostSchema } from "@/lib/contentops/blog-schema";
import { updateDraftContent } from "@/lib/contentops/drafts-store";
import { captureServerError } from "@/lib/error-observability";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** ~200 wpm, floor 1 minute — recomputed on every edit so the label never drifts from the body. */
function computeReadTime(sections: { content: string[] }[]): string {
  const words = sections.reduce(
    (sum, section) =>
      sum +
      section.content.reduce(
        (s, paragraph) => s + paragraph.trim().split(/\s+/).filter(Boolean).length,
        0,
      ),
    0,
  );
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

export async function PATCH(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const content = (body as { content?: unknown })?.content;
  const parsed = blogPostSchema.safeParse(content);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return NextResponse.json(
      { ok: false, error: "Draft content failed validation", details: errors },
      { status: 422 },
    );
  }

  if (!SLUG_PATTERN.test(parsed.data.slug)) {
    return NextResponse.json(
      { ok: false, error: "Slug must be lowercase words separated by hyphens (a-z, 0-9)." },
      { status: 422 },
    );
  }

  // readTime is derived, not authored — recompute so the label always
  // matches the edited body.
  const next = { ...parsed.data, readTime: computeReadTime(parsed.data.sections) };

  try {
    const draft = await updateDraftContent(id, next);
    await logAdminAudit(request, {
      action: "contentops_draft_edit",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: { slug: draft.slug, status: draft.status },
    }).catch(() => {});
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update draft";
    const refused = message.includes("cannot be edited");
    if (!refused) {
      captureServerError(
        "api_admin_contentops_edit_failed",
        err instanceof Error ? err : new Error(message),
        { draftId: id },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: refused ? 409 : 500 });
  }
}
