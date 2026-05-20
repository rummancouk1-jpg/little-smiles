// One-click AI image generation. Pipeline:
//   1. Verify admin auth + draft is editable.
//   2. Resolve the prompt for the requested slot, falling back to the
//      slot-specific composer when the draft has no prompts yet.
//   3. Call the configured ImageProvider (resolveImageProvider()).
//   4. Upload the returned bytes to Supabase Storage.
//   5. Run the shared optimization helper (WebP variant + blur).
//   6. Attach the BlogImage to the slot via the existing engine helper.
//   7. Audit + respond.
//
// Generation can take 15–40 seconds — maxDuration is raised to 60.
// Every failure mode returns a calm operator-readable error string;
// the route never throws to the client.

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  SLOT_DIMENSIONS,
  isBlogImageSlot,
  type BlogImage,
  type BlogImageSlot,
} from "@/lib/contentops/blog-schema";
import {
  attachDraftImage,
  getDraftById,
} from "@/lib/contentops/drafts-store";
import { composeImagePrompts } from "@/lib/contentops/intelligence/image-prompts";
import { optimizeUploadedImage } from "@/lib/contentops/intelligence/image-optimization";
import {
  resolveImageProvider,
  type ImageGenerationRequest,
  type ImageProviderId,
} from "@/lib/contentops/intelligence/image-providers";
import { composeImageSeo } from "@/lib/contentops/intelligence/image-seo";
import { composePinterestSeo } from "@/lib/contentops/intelligence/pinterest";
import { uploadDraftImage } from "@/lib/contentops/storage";
import { captureServerError } from "@/lib/error-observability";

export const maxDuration = 60;

const bodySchema = z.object({
  slot: z.enum(["hero", "thumbnail", "og", "pinterest"]),
  /** Optional override — operator can edit before generating. */
  promptOverride: z.string().max(2000).optional(),
});

type RouteProps = {
  params: Promise<{ id: string }>;
};

function aspectForSlot(slot: BlogImageSlot): ImageGenerationRequest["aspect"] {
  return SLOT_DIMENSIONS[slot].aspect;
}

type PromptSet = {
  hero: string;
  thumbnail: string;
  og: string;
  /** Stored prompts may be missing pinterest if the draft was created
   *  before the Pinterest slot was added. The route falls back to a
   *  freshly composed prompt set in that case. */
  pinterest?: string;
};

function pickPromptForSlot(
  slot: BlogImageSlot,
  promptSet: PromptSet,
  fresh: ReturnType<typeof composeImagePrompts>,
): string {
  switch (slot) {
    case "hero":
      return promptSet.hero;
    case "thumbnail":
      return promptSet.thumbnail;
    case "og":
      return promptSet.og;
    case "pinterest":
      return promptSet.pinterest ?? fresh.pinterest;
  }
}

export async function POST(request: Request, { params }: RouteProps) {
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !isBlogImageSlot(parsed.data.slot)) {
    return NextResponse.json(
      { ok: false, error: "Invalid generation payload" },
      { status: 400 },
    );
  }
  const slot: BlogImageSlot = parsed.data.slot;

  // ----- Draft + provider preflight ----------------------------------
  let draft;
  try {
    draft = await getDraftById(id);
  } catch (err) {
    captureServerError(
      "api_admin_contentops_image_generate_read_failed",
      err instanceof Error ? err : new Error(String(err)),
      { draftId: id, slot },
    );
    return NextResponse.json({ ok: false, error: "Failed to read draft" }, { status: 500 });
  }
  if (!draft) {
    return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
  }
  if (draft.status === "published") {
    return NextResponse.json(
      { ok: false, error: "Cannot generate images for a published draft" },
      { status: 400 },
    );
  }

  const provider = resolveImageProvider();
  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No image generation provider configured. Set IMAGE_PROVIDER and the provider's API key.",
      },
      { status: 503 },
    );
  }

  // ----- Resolve the prompt -----------------------------------------
  // Always compose a fresh prompt set so the Pinterest slot has a
  // baseline even for drafts that predate Pinterest support.
  const freshPrompts = composeImagePrompts({ post: draft.content });
  const promptSet: PromptSet = draft.content.imagePrompts ?? freshPrompts;
  let prompt =
    parsed.data.promptOverride?.trim() ||
    pickPromptForSlot(slot, promptSet, freshPrompts);

  // For Pinterest, prefer the Pinterest-intelligence pin prompt over
  // the generic prompt composer if the operator hasn't customized it.
  if (slot === "pinterest" && !parsed.data.promptOverride) {
    const pinterestSeo = composePinterestSeo({ post: draft.content });
    prompt = pinterestSeo.pinPrompt;
  }

  if (!prompt || prompt.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Could not compose a prompt for this slot." },
      { status: 400 },
    );
  }

  // ----- Generate ----------------------------------------------------
  const generation = await provider.generate({
    prompt,
    aspect: aspectForSlot(slot),
    quality: "high",
  });
  if (!generation.ok) {
    return NextResponse.json(
      { ok: false, error: generation.error, provider: generation.provider },
      { status: 502 },
    );
  }

  // ----- Upload original --------------------------------------------
  // gpt-image-1 (and most providers) return PNG. We upload as-is so
  // the user-facing URL stays predictable; the optimizer below adds a
  // WebP variant the renderer can prefer.
  const ext = generation.bytes.contentType === "image/png" ? "png" : generation.bytes.contentType === "image/jpeg" ? "jpg" : "webp";
  const filename = `${slot}-${randomUUID()}.${ext}`;

  let stored;
  try {
    stored = await uploadDraftImage(
      id,
      filename,
      generation.bytes.buffer,
      generation.bytes.contentType,
    );
  } catch (err) {
    captureServerError(
      "api_admin_contentops_image_generate_storage_failed",
      err instanceof Error ? err : new Error(String(err)),
      { draftId: id, slot, provider: generation.provider },
    );
    return NextResponse.json(
      { ok: false, error: "Generated image could not be uploaded. Is the bucket configured?" },
      { status: 500 },
    );
  }

  // ----- Optimize ----------------------------------------------------
  // Pull true dimensions through sharp (provider sometimes returns
  // slightly different pixels than requested).
  let width = generation.bytes.width;
  let height = generation.bytes.height;
  try {
    const meta = await sharp(generation.bytes.buffer).metadata();
    width = meta.width ?? width;
    height = meta.height ?? height;
  } catch {
    // Fall back to provider-claimed dimensions.
  }
  const optimization = await optimizeUploadedImage({
    draftId: id,
    originalStorageKey: stored.storageKey,
    buffer: generation.bytes.buffer,
    width,
    height,
  }).catch(() => ({ variants: [], blurDataUrl: null }));

  // ----- Compose alt + caption from image-seo intelligence ----------
  const seo = composeImageSeo({ post: draft.content, slot });

  const blogImage: BlogImage = {
    url: stored.publicUrl,
    altText: seo.altText,
    ...(seo.caption ? { caption: seo.caption } : {}),
    width,
    height,
    storageKey: stored.storageKey,
    bytes: generation.bytes.buffer.byteLength,
    generatedBy: generation.provider as ImageProviderId,
    ...(optimization.variants.length > 0 ? { variants: optimization.variants } : {}),
    ...(optimization.blurDataUrl ? { blurDataUrl: optimization.blurDataUrl } : {}),
  };

  // ----- Attach to slot ---------------------------------------------
  let updatedDraft;
  try {
    updatedDraft = await attachDraftImage(id, slot, blogImage);
  } catch (err) {
    captureServerError(
      "api_admin_contentops_image_generate_attach_failed",
      err instanceof Error ? err : new Error(String(err)),
      { draftId: id, slot, provider: generation.provider },
    );
    const message = err instanceof Error ? err.message : "Failed to attach generated image";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  await logAdminAudit(request, {
    action: "contentops_image_generated",
    targetType: "contentops_draft",
    targetId: id,
    metadata: {
      slot,
      provider: generation.provider,
      storageKey: stored.storageKey,
      width,
      height,
      promptLength: prompt.length,
      variantCount: optimization.variants.length,
    },
  });

  return NextResponse.json({
    ok: true,
    image: blogImage,
    draft: updatedDraft,
    provider: generation.provider,
  });
}
