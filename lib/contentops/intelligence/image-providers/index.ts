// Image-provider extension point. Phase 5 wires real generation: the
// API route at /api/admin/contentops/drafts/[id]/images/generate calls
// resolveImageProvider() and pipes the returned bytes through the
// existing upload + attach flow.
//
// Provider selection is env-driven so the operator can switch backends
// without code changes. IMAGE_PROVIDER picks one of:
//   - "openai"        OpenAI Images (gpt-image-1)
//   - "flux"          Black Forest Labs FLUX (via Replicate or BFL API)
//   - "imagen"        Google Imagen 3 via Vertex
//   - "ideogram"      Ideogram v2
//
// Each adapter implements isConfigured() to gate the resolver — when
// the configured provider isn't fully wired, the API returns a calm
// "image generation not configured" error and the operator keeps using
// the manual prompt-copy workflow.
//
// Each adapter is responsible only for: prompt → bytes. The route
// handles storage upload + slot attachment so the upload/attach
// guarantees stay in one place.

import { fluxProvider } from "@/lib/contentops/intelligence/image-providers/flux";
import { ideogramProvider } from "@/lib/contentops/intelligence/image-providers/ideogram";
import { imagenProvider } from "@/lib/contentops/intelligence/image-providers/imagen";
import { openaiProvider } from "@/lib/contentops/intelligence/image-providers/openai";

export type ImageProviderId = "openai" | "flux" | "imagen" | "ideogram";

export type ImageGenerationRequest = {
  prompt: string;
  /** Aspect ratio the slot needs. Providers map this to their own size
   *  parameter (e.g. 1024x1024 vs 1024x1792). */
  aspect: "16:9" | "1:1" | "1200x630" | "2:3";
  /** Editorial-quality output preferred; providers may ignore. */
  quality?: "standard" | "high";
};

export type GeneratedImageBytes = {
  /** Raw image bytes. */
  buffer: Buffer;
  /** Detected/produced mime type. Always one of the supported types. */
  contentType: "image/png" | "image/webp" | "image/jpeg";
  /** Pixel dimensions of the produced image. */
  width: number;
  height: number;
};

export type ImageGenerationResult =
  | {
      ok: true;
      provider: ImageProviderId;
      bytes: GeneratedImageBytes;
    }
  | { ok: false; provider: ImageProviderId | "none"; error: string };

export interface ImageProvider {
  readonly id: ImageProviderId;
  isConfigured(): boolean;
  generate(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

const PROVIDERS: Record<ImageProviderId, ImageProvider> = {
  openai: openaiProvider,
  flux: fluxProvider,
  imagen: imagenProvider,
  ideogram: ideogramProvider,
};

/**
 * Resolve the configured provider. The operator chooses one via
 * IMAGE_PROVIDER; if unset, we fall back to whichever single adapter
 * is configured. When nothing is configured we return null and the
 * route surfaces a calm "configure an image provider" message.
 */
export function resolveImageProvider(): ImageProvider | null {
  const explicit = process.env.IMAGE_PROVIDER?.trim().toLowerCase() as
    | ImageProviderId
    | undefined;
  if (explicit && explicit in PROVIDERS) {
    const candidate = PROVIDERS[explicit];
    if (candidate.isConfigured()) return candidate;
    return null;
  }
  // No explicit choice — return the first configured adapter, if any.
  for (const id of ["openai", "flux", "imagen", "ideogram"] as ImageProviderId[]) {
    if (PROVIDERS[id].isConfigured()) return PROVIDERS[id];
  }
  return null;
}

/**
 * Operator-visible list of which adapters are configured. Used by the
 * media page to show calm provider-status hints.
 */
export function describeProviderState(): Array<{
  id: ImageProviderId;
  configured: boolean;
}> {
  return (["openai", "flux", "imagen", "ideogram"] as ImageProviderId[]).map(
    (id) => ({ id, configured: PROVIDERS[id].isConfigured() }),
  );
}
