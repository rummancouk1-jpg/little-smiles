// Image upload endpoint. Multipart form expects:
//   file:     image/jpeg | image/png | image/webp, <= 8 MB
//   altText:  required, 1..500 chars
//
// Validates type/size, extracts dimensions via sharp, writes the blob to
// Supabase Storage at <draft_id>/<uuid>.<ext>, and returns a BlogImage
// object the client can subsequently attach to a slot via
// POST .../images/<slot>.
//
// Upload alone does NOT mutate the draft's content. A separate attach
// call is required so the operator can preview before committing to a
// slot, and so failed attach attempts don't orphan the blob from a
// hard-coded reference.

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { getDraftById } from "@/lib/contentops/drafts-store";
import { uploadDraftImage } from "@/lib/contentops/storage";
import { captureServerError } from "@/lib/error-observability";

const MAX_BYTES = 8 * 1024 * 1024;
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 4000;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ALT_TEXT_MAX = 500;

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify draft exists and is in an editable state before touching storage.
  let draft;
  try {
    draft = await getDraftById(id);
  } catch (err) {
    captureServerError(
      "api_admin_contentops_image_upload_read_failed",
      err instanceof Error ? err : new Error(String(err)),
      { draftId: id },
    );
    return NextResponse.json(
      { ok: false, error: "Failed to read draft" },
      { status: 500 },
    );
  }
  if (!draft) {
    return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
  }
  if (draft.status === "published") {
    return NextResponse.json(
      { ok: false, error: "Cannot upload images to a published draft" },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid multipart body" },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Missing 'file' field" },
      { status: 400 },
    );
  }
  if (!Object.keys(EXT_BY_TYPE).includes(fileEntry.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported file type '${fileEntry.type}'. Use JPEG, PNG, or WebP.`,
      },
      { status: 400 },
    );
  }
  if (fileEntry.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File too large (max 8 MB)" },
      { status: 400 },
    );
  }

  const altTextRaw = formData.get("altText");
  const altText = typeof altTextRaw === "string" ? altTextRaw.trim() : "";
  if (altText.length === 0) {
    return NextResponse.json(
      { ok: false, error: "altText is required (describe the image for accessibility)" },
      { status: 400 },
    );
  }
  if (altText.length > ALT_TEXT_MAX) {
    return NextResponse.json(
      { ok: false, error: `altText too long (max ${ALT_TEXT_MAX} characters)` },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await fileEntry.arrayBuffer());
  } catch (err) {
    captureServerError(
      "api_admin_contentops_image_upload_buffer_failed",
      err instanceof Error ? err : new Error(String(err)),
      { draftId: id },
    );
    return NextResponse.json(
      { ok: false, error: "Failed to read uploaded file" },
      { status: 400 },
    );
  }

  let width = 0;
  let height = 0;
  try {
    const metadata = await sharp(buffer).metadata();
    width = metadata.width ?? 0;
    height = metadata.height ?? 0;
  } catch (err) {
    captureServerError(
      "api_admin_contentops_image_upload_metadata_failed",
      err instanceof Error ? err : new Error(String(err)),
      { draftId: id },
    );
    return NextResponse.json(
      { ok: false, error: "Failed to read image metadata (corrupt file?)" },
      { status: 400 },
    );
  }

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return NextResponse.json(
      {
        ok: false,
        error: `Image too small (minimum ${MIN_DIMENSION}x${MIN_DIMENSION}). Got ${width}x${height}.`,
      },
      { status: 400 },
    );
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return NextResponse.json(
      {
        ok: false,
        error: `Image too large (maximum ${MAX_DIMENSION}x${MAX_DIMENSION}). Got ${width}x${height}.`,
      },
      { status: 400 },
    );
  }

  const ext = EXT_BY_TYPE[fileEntry.type];
  const filename = `${randomUUID()}.${ext}`;

  let stored;
  try {
    stored = await uploadDraftImage(id, filename, buffer, fileEntry.type);
  } catch (err) {
    captureServerError(
      "api_admin_contentops_image_upload_storage_failed",
      err instanceof Error ? err : new Error(String(err)),
      { draftId: id, filename },
    );
    return NextResponse.json(
      { ok: false, error: "Storage upload failed. Is the bucket configured?" },
      { status: 500 },
    );
  }

  const blogImage = {
    url: stored.publicUrl,
    altText,
    width,
    height,
    storageKey: stored.storageKey,
  };

  await logAdminAudit(request, {
    action: "contentops_image_uploaded",
    targetType: "contentops_draft",
    targetId: id,
    metadata: {
      storageKey: stored.storageKey,
      width,
      height,
      sizeBytes: fileEntry.size,
      contentType: fileEntry.type,
    },
  });

  return NextResponse.json({ ok: true, image: blogImage });
}
