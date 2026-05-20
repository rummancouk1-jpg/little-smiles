// Operator content edit. PATCH-shaped because the body carries only the
// fields the operator changed; the engine merges into the draft's
// current content and re-validates the whole against blogPostSchema.
//
// Slug is deliberately not in the editable surface — changing it would
// break URL semantics and the active-slug uniqueness invariant. Hero/
// thumbnail metadata edits flow through .../images/[slot] (PATCH) so
// the binary lifecycle and the metadata edit don't tangle.

import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  blogCategorySchema,
  blogRelatedProductCategorySchema,
  blogSectionSchema,
} from "@/lib/contentops/blog-schema";
import { editDraftContent } from "@/lib/contentops/drafts-store";
import { captureServerError } from "@/lib/error-observability";

const ctaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const bodySchema = z.object({
  content: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      category: blogCategorySchema.optional(),
      relatedProductCategory: blogRelatedProductCategorySchema.optional(),
      publishedAt: z.string().min(1).optional(),
      readTime: z.string().min(1).optional(),
      keywords: z.array(z.string().min(1)).optional(),
      sections: z.array(blogSectionSchema).optional(),
      cta: ctaSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Edit payload is empty.",
    }),
});

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit payload" },
      { status: 400 },
    );
  }

  try {
    const draft = await editDraftContent(id, parsed.data.content);
    const changedFields = Object.keys(parsed.data.content).filter(
      (key) => (parsed.data.content as Record<string, unknown>)[key] !== undefined,
    );
    await logAdminAudit(request, {
      action: "contentops_draft_edited",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: {
        slug: draft.slug,
        status: draft.status,
        changedFields,
      },
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save edit";
    captureServerError(
      "api_admin_contentops_draft_edit_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id },
    );
    // Schema-violation messages from the engine include "Edit would
    // break the article schema" — surface them as 400 so the form can
    // render them as actionable, not catastrophic.
    const isSchemaError = message.includes("schema");
    return NextResponse.json(
      { ok: false, error: message },
      { status: isSchemaError ? 400 : 500 },
    );
  }
}
