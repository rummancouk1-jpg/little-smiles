// Image-provider extension point. Phase 1 ships the prompt composer
// only; nothing here is called from runtime code yet. The shape exists
// so a future commit can drop in a concrete provider (OpenAI Images,
// Gemini Imagen, Replicate Flux) without restructuring callers.
//
// Each provider implements ImageProvider. The dispatcher selects one via
// IMAGE_PROVIDER env at call-site time. Until any provider is wired in,
// resolveImageProvider() returns null and operators continue copying the
// composed prompts into their own image tool by hand.

export type ImageProviderId = "openai" | "imagen" | "replicate-flux";

export type ImageGenerationRequest = {
  prompt: string;
  /** Aspect ratio the surface needs ("16:9" hero, "1:1" thumb, "1200x630" og). */
  aspect: "16:9" | "1:1" | "1200x630";
  /** Editorial-quality output preferred; providers may ignore. */
  quality?: "standard" | "high";
};

export type ImageGenerationResult =
  | { ok: true; url: string; width: number; height: number; provider: ImageProviderId }
  | { ok: false; error: string };

export interface ImageProvider {
  readonly id: ImageProviderId;
  isConfigured(): boolean;
  generate(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

/**
 * Picks the configured provider based on IMAGE_PROVIDER env. Returns
 * null when nothing is wired in. Callers should fall back to "operator
 * copies the prompt manually" UX on null.
 */
export function resolveImageProvider(): ImageProvider | null {
  // Intentional Phase-2 stub. Replace this body with provider lookup
  // when a real backend is wired in.
  return null;
}
