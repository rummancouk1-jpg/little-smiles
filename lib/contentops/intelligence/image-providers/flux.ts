// FLUX adapter. Phase 5 ships the interface and env detection only —
// the actual API call lives here as a TODO so a follow-up commit can
// wire either Black Forest Labs' direct API or Replicate's FLUX
// endpoints without changing call sites.
//
// Config (when wired in a follow-up):
//   FLUX_API_KEY    Bearer for the chosen backend
//   FLUX_BACKEND    "bfl" (Black Forest direct) or "replicate"
//   FLUX_MODEL      Specific model id; defaults vary by backend
//
// isConfigured() intentionally checks env so a future operator can
// enable the provider by setting the variables and dropping in the
// fetch body below. Until then, calls return a calm "not yet wired"
// error and the operator UI keeps the manual prompt-copy workflow.

import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "@/lib/contentops/intelligence/image-providers";

export const fluxProvider: ImageProvider = {
  id: "flux",

  isConfigured(): boolean {
    // Two env vars required so we don't half-claim configured.
    return (
      Boolean(process.env.FLUX_API_KEY?.trim()) &&
      Boolean(process.env.FLUX_BACKEND?.trim())
    );
  },

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        provider: "flux",
        error: "FLUX provider is not configured. Set FLUX_API_KEY and FLUX_BACKEND.",
      };
    }
    // TODO(phase-5+): implement direct fetch to the BFL or Replicate
    // endpoint, request synchronous response, return PNG bytes. The
    // aspect (req.aspect) maps cleanly to FLUX's width/height params.
    return {
      ok: false,
      provider: "flux",
      error: `FLUX provider adapter is wired but the request body is not yet implemented. (requested aspect: ${req.aspect})`,
    };
  },
};
