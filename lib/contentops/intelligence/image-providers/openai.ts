// OpenAI Images adapter (gpt-image-1). Canonical reference
// implementation for the ImageProvider interface — direct fetch, no
// extra SDK dependency.
//
// Config:
//   OPENAI_API_KEY              required
//   OPENAI_IMAGE_MODEL          optional, defaults to "gpt-image-1"
//
// The aspect → size map is constrained to the values the API
// currently accepts for gpt-image-1. Pinterest's true 2:3 ratio is
// not natively supported, so we ask for 1024×1536 (closest tall
// aspect) and the sharp post-processor crops to 1000×1500 downstream.

import type {
  GeneratedImageBytes,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "@/lib/contentops/intelligence/image-providers";

const DEFAULT_MODEL = "gpt-image-1";
const ENDPOINT = "https://api.openai.com/v1/images/generations";

function aspectToSize(
  aspect: ImageGenerationRequest["aspect"],
): { size: string; width: number; height: number } {
  switch (aspect) {
    case "16:9":
      return { size: "1536x1024", width: 1536, height: 1024 };
    case "1:1":
      return { size: "1024x1024", width: 1024, height: 1024 };
    case "2:3":
      return { size: "1024x1536", width: 1024, height: 1536 };
    case "1200x630":
      return { size: "1536x1024", width: 1536, height: 1024 };
  }
}

export const openaiProvider: ImageProvider = {
  id: "openai",

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  },

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, provider: "openai", error: "OPENAI_API_KEY is not set." };
    }
    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
    const { size, width, height } = aspectToSize(req.aspect);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: req.prompt,
          size,
          // gpt-image-1 returns base64 by default; we request explicitly
          // so the route never has to download a temporary URL.
          response_format: "b64_json",
          quality: req.quality === "high" ? "high" : "medium",
          n: 1,
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          ok: false,
          provider: "openai",
          error: `OpenAI image API failed (${response.status}): ${text.slice(0, 200)}`,
        };
      }
      const json = (await response.json()) as {
        data?: Array<{ b64_json?: string }>;
      };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) {
        return {
          ok: false,
          provider: "openai",
          error: "OpenAI image API returned no image payload.",
        };
      }
      const buffer = Buffer.from(b64, "base64");
      const bytes: GeneratedImageBytes = {
        buffer,
        // gpt-image-1 returns PNG.
        contentType: "image/png",
        width,
        height,
      };
      return { ok: true, provider: "openai", bytes };
    } catch (err) {
      return {
        ok: false,
        provider: "openai",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
