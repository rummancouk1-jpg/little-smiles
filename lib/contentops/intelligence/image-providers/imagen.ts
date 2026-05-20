// Google Imagen adapter. Phase 5 ships the interface + env detection
// only; the actual Vertex API fetch is left as a TODO so a follow-up
// commit can wire it in without restructuring callers.
//
// Config (when wired):
//   IMAGEN_PROJECT_ID        GCP project id
//   IMAGEN_LOCATION          Vertex region (default "us-central1")
//   IMAGEN_BEARER_TOKEN      Short-lived OAuth2 token with vertex scope
//   IMAGEN_MODEL             Imagen model id (default "imagen-3.0-generate-001")
//
// We require a bearer token rather than a service-account JWT to keep
// this module dependency-free; the operator refreshes the token
// externally (same pattern as the GA4 adapter).

import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProvider,
} from "@/lib/contentops/intelligence/image-providers";

export const imagenProvider: ImageProvider = {
  id: "imagen",

  isConfigured(): boolean {
    return (
      Boolean(process.env.IMAGEN_PROJECT_ID?.trim()) &&
      Boolean(process.env.IMAGEN_BEARER_TOKEN?.trim())
    );
  },

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        provider: "imagen",
        error:
          "Imagen provider is not configured. Set IMAGEN_PROJECT_ID and IMAGEN_BEARER_TOKEN.",
      };
    }
    // TODO(phase-5+): POST to https://<region>-aiplatform.googleapis.com
    // /v1/projects/.../publishers/google/models/<model>:predict with
    // the Imagen instances schema; map response.predictions[0].bytesBase64Encoded
    // back into the GeneratedImageBytes shape. Use req.aspect to choose
    // aspectRatio ("16:9" / "1:1" / etc).
    return {
      ok: false,
      provider: "imagen",
      error: `Imagen provider adapter is wired but the request body is not yet implemented. (requested aspect: ${req.aspect})`,
    };
  },
};
