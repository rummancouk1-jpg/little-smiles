// Slot endpoints for image management.
//
//   POST   .../images/<slot>   body: { image: BlogImage }
//                              Attaches the image to the slot in the
//                              draft's content.
//
//   PATCH  .../images/<slot>   body: { altText?, caption? }
//                              Metadata-only edit (Commit X). Updates
//                              alt text and/or caption on the attached
//                              image without re-uploading the blob.
//
//   DELETE .../images/<slot>   Detaches the image and, if it has a
//                              storageKey, deletes the blob from the
//                              bucket.
//
// Slot must be 'hero' or 'thumbnail'. The schema is ready for section
// slots; section attachment lands in a later commit.

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
  editDraftImageMetadata,
} from "@/lib/contentops/drafts-store";
import { deleteDraftImage } from "@/lib/contentops/storage";
import { captureServerError } from "@/lib/error-observability";
import { z } from "zod";

const attachBodySchema = z.object({
  image: blogImageSchema,
});

const metadataPatchSchema = z
  .object({
    altText: z.string().min(1).max(500).optional(),
    caption: z.string().max(500).nullable().optional(),
  })
  .refine((data) => data.altText !== undefined || data.caption !== undefined, {
    message: "Patch must include altText and/or caption.",
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

export async function PATCH(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id, slot } = await params;
  if (!isBlogImageSlot(slot)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported image slot '${slot}'.` },
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
  const parsed = metadataPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid metadata payload" },
      { status: 400 },
    );
  }

  try {
    const draft = await editDraftImageMetadata(id, slot, {
      altText: parsed.data.altText,
      caption: parsed.data.caption,
    });
    await logAdminAudit(request, {
      action: "contentops_image_metadata_edited",
      targetType: "contentops_draft",
      targetId: id,
      metadata: {
        slot,
        editedAlt: parsed.data.altText !== undefined,
        editedCaption: parsed.data.caption !== undefined,
      },
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update image metadata";
    captureServerError(
      "api_admin_contentops_image_metadata_edit_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id, slot },
    );
    const status =
      message.includes("Cannot") || message.includes("No image") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
