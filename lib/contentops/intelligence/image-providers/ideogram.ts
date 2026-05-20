// Ideogram adapter. Phase 5 ships the interface + env detection only;
// the API fetch is left as a TODO so a follow-up commit can wire it in
// behind the same interface.
//
// Config (when wired):
//   IDEOGRAM_API_KEY    Bearer for api.ideogram.ai
//   IDEOGRAM_MODEL      Model id (default "ideogram-v2")
//
// Ideogram is especially strong on type-friendly imagery, which makes
// it a good fit for the OG / Pinterest pin slots when the operator
// wants subtle text styling. Default selection remains OpenAI.

import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "@/lib/contentops/intelligence/image-providers";

export const ideogramProvider: ImageProvider = {
  id: "ideogram",

  isConfigured(): boolean {
    return Boolean(process.env.IDEOGRAM_API_KEY?.trim());
  },

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        provider: "ideogram",
        error: "Ideogram provider is not configured. Set IDEOGRAM_API_KEY.",
      };
    }
    // TODO(phase-5+): POST to https://api.ideogram.ai/generate, map
    // req.aspect → aspect_ratio, return the URL's bytes via a follow-up
    // fetch. Use response_format binary when available.
    return {
      ok: false,
      provider: "ideogram",
      error: `Ideogram provider adapter is wired but the request body is not yet implemented. (requested aspect: ${req.aspect})`,
    };
  },
};
