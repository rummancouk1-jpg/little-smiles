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

// ---------------------------------------------------------------------------
// Orphan cleanup helpers
// ---------------------------------------------------------------------------
// A storage key counts as orphaned when no draft in the catalog
// references it from any image slot (hero / thumbnail / og / pinterest)
// or from any variant. We list the bucket, build a referenced-set from
// the drafts, and return the difference.
//
// Operator-triggered; not a cron. The sweep is admin-gated and bounded
// by `limit` so a fat bucket can't lock up a request.

export type StorageEntry = {
  storageKey: string;
  /** Bucket-reported size in bytes if available, else null. */
  bytes: number | null;
};

/**
 * Enumerate all blobs in the bucket. Bucket paths follow
 * `<draft_id>/<filename>` so we walk the root prefix and recurse into
 * each draft folder once.
 */
export async function listAllBucketObjects(): Promise<StorageEntry[]> {
  const client = requireClient();
  const entries: StorageEntry[] = [];

  // Top-level listing — each item is a draft-id folder.
  const { data: folders, error: folderErr } = await client.storage
    .from(CONTENTOPS_IMAGE_BUCKET)
    .list("", { limit: 1000 });
  if (folderErr) {
    throw new Error(`Bucket list failed: ${folderErr.message}`);
  }
  if (!folders) return entries;

  for (const folder of folders) {
    // Supabase returns both directories and files at the root level.
    // Folders carry an `id` of null and a non-zero metadata.size of 0.
    // Skip everything that isn't shaped like a draft folder.
    const folderName = folder.name;
    if (!folderName || folder.id) {
      // A non-null `id` means it's a leaf file at the root — unusual
      // for this bucket but we should still surface it as an orphan.
      if (folderName) {
        entries.push({
          storageKey: folderName,
          bytes:
            typeof (folder.metadata as { size?: number } | null)?.size === "number"
              ? ((folder.metadata as { size: number }).size as number)
              : null,
        });
      }
      continue;
    }

    const { data: files, error: filesErr } = await client.storage
      .from(CONTENTOPS_IMAGE_BUCKET)
      .list(folderName, { limit: 1000 });
    if (filesErr) continue; // best-effort
    for (const f of files ?? []) {
      if (!f.name) continue;
      entries.push({
        storageKey: `${folderName}/${f.name}`,
        bytes:
          typeof (f.metadata as { size?: number } | null)?.size === "number"
            ? ((f.metadata as { size: number }).size as number)
            : null,
      });
    }
  }

  return entries;
}

/**
 * Bulk delete. Operator-gated; we never call this from background
 * paths. Returns the count of objects requested vs successfully
 * removed.
 */
export async function bulkDeleteStorageKeys(
  keys: string[],
): Promise<{ requested: number; removed: number; error?: string }> {
  if (keys.length === 0) return { requested: 0, removed: 0 };
  const client = requireClient();
  const { data, error } = await client.storage
    .from(CONTENTOPS_IMAGE_BUCKET)
    .remove(keys);
  if (error) {
    return { requested: keys.length, removed: 0, error: error.message };
  }
  return { requested: keys.length, removed: data?.length ?? 0 };
}
