// Slot endpoints for image management.
//
//   POST   .../images/<slot>   body: { image: BlogImage }
//                              Attaches the image to the slot in the
//                              draft's content. The image must have been
//                              produced by .../images/upload (typically),
//                              though arbitrary URL references are
//                              accepted to support manual seed flows.
//
//   DELETE .../images/<slot>   Detaches the image and, if it has a
//                              storageKey (i.e. it was uploaded through
//                              this system), deletes the blob from the
//                              bucket. Static-seed images without a
//                              storageKey are detached but their public
//                              assets remain untouched.
//
// Slot must be 'hero' or 'thumbnail' for Commit N. The schema is ready
// for section-N slots; the API rejects them until a later commit wires
// the editorial workflow for inline section images.

import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  blogImageSchema,
  isBlogImageSlot,
} from "@/lib/contentops/blog-schema";
import {
  attachDraftImage,
  detachDraftImage,
} from "@/lib/contentops/drafts-store";
import { deleteDraftImage } from "@/lib/contentops/storage";
import { captureServerError } from "@/lib/error-observability";
import { z } from "zod";

const attachBodySchema = z.object({
  image: blogImageSchema,
});

type RouteProps = {
  params: Promise<{ id: string; slot: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id, slot } = await params;
  if (!isBlogImageSlot(slot)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported image slot '${slot}'. Commit N supports hero and thumbnail.`,
      },
      { status: 400 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = attachBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid image payload" },
      { status: 400 },
    );
  }

  try {
    const draft = await attachDraftImage(id, slot, parsed.data.image);
    await logAdminAudit(request, {
      action: "contentops_image_attached",
      targetType: "contentops_draft",
      targetId: id,
      metadata: {
        slot,
        storageKey: parsed.data.image.storageKey ?? null,
        width: parsed.data.image.width,
        height: parsed.data.image.height,
      },
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to attach image";
    captureServerError(
      "api_admin_contentops_image_attach_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id, slot },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id, slot } = await params;
  if (!isBlogImageSlot(slot)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported image slot '${slot}'. Commit N supports hero and thumbnail.`,
      },
      { status: 400 },
    );
  }

  try {
    const { draft, removedImage } = await detachDraftImage(id, slot);
    // Best-effort blob delete. The slot is already detached from the
    // draft's content; if storage removal fails the only consequence is
    // an orphan blob. We log to Sentry but don't fail the request — the
    // operator's intent (the image is gone from the draft) is satisfied.
    if (removedImage?.storageKey) {
      try {
        await deleteDraftImage(removedImage.storageKey);
      } catch (storageErr) {
        captureServerError(
          "api_admin_contentops_image_blob_delete_failed",
          storageErr instanceof Error
            ? storageErr
            : new Error(String(storageErr)),
          {
            draftId: id,
            slot,
            storageKey: removedImage.storageKey,
          },
        );
      }
    }
    await logAdminAudit(request, {
      action: "contentops_image_removed",
      targetType: "contentops_draft",
      targetId: id,
      metadata: {
        slot,
        storageKey: removedImage?.storageKey ?? null,
        hadImage: Boolean(removedImage),
      },
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove image";
    captureServerError(
      "api_admin_contentops_image_remove_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id, slot },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
