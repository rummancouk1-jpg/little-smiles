// Engine-side helpers for the ContentOps image bucket in Supabase Storage.
// No project-specific imports. The bucket must be provisioned once (see
// RUNBOOK) and made public so the rendered `url` values resolve without
// auth.
//
// Path convention: <draft_id>/<filename>. Generalizes trivially to
// <tenant_id>/<draft_id>/<filename> when multi-tenant lands.

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const CONTENTOPS_IMAGE_BUCKET = "contentops-images";

function requireClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase admin client is not configured.");
  }
  return client;
}

export type UploadedImageRef = {
  storageKey: string;
  publicUrl: string;
};

export async function uploadDraftImage(
  draftId: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadedImageRef> {
  const client = requireClient();
  const storageKey = `${draftId}/${filename}`;
  const { error: uploadError } = await client.storage
    .from(CONTENTOPS_IMAGE_BUCKET)
    .upload(storageKey, buffer, {
      contentType,
      // Cache-immutable: filenames are content-unique UUIDs, so the URL
      // never points at a different blob. Browsers can hold the image
      // indefinitely without revalidation.
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }
  const { data: publicData } = client.storage
    .from(CONTENTOPS_IMAGE_BUCKET)
    .getPublicUrl(storageKey);
  return { storageKey, publicUrl: publicData.publicUrl };
}

export async function deleteDraftImage(storageKey: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.storage
    .from(CONTENTOPS_IMAGE_BUCKET)
    .remove([storageKey]);
  if (error) {
    // Re-throw so the caller can decide whether to surface or swallow.
    // The API route currently treats blob-delete failures as non-fatal
    // (the slot is already detached from content) but captures via
    // Sentry for visibility.
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}
