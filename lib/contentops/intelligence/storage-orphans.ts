// Pure orphan computation. Takes the bucket listing + the draft list
// and returns the storage keys that no draft (in any slot, in any
// variant) references. The API route consumes this and the operator
// either reviews or sweeps.

import type { BlogImage } from "@/lib/contentops/blog-schema";
import type { Draft } from "@/lib/contentops/drafts-store";
import type { StorageEntry } from "@/lib/contentops/storage";

function collectKeysFromImage(image: BlogImage | undefined): string[] {
  if (!image) return [];
  const out: string[] = [];
  if (image.storageKey) out.push(image.storageKey);
  for (const v of image.variants ?? []) {
    if (v.storageKey) out.push(v.storageKey);
  }
  return out;
}

/**
 * Build the set of every storage key referenced by any draft, in any
 * slot, in any variant. Includes ai_generated_content and
 * previous_content snapshots so revision-restore paths don't 404 on a
 * recently-swept bucket.
 */
export function collectReferencedKeys(drafts: Draft[]): Set<string> {
  const out = new Set<string>();
  const eat = (image: BlogImage | undefined) => {
    for (const k of collectKeysFromImage(image)) out.add(k);
  };
  const eatContent = (
    content: Draft["content"] | Draft["ai_generated_content"] | Draft["previous_content"],
  ) => {
    if (!content) return;
    eat(content.hero);
    eat(content.thumbnail);
    eat(content.og);
    eat(content.pinterest);
    for (const section of content.sections ?? []) {
      eat(section.image);
    }
  };
  for (const draft of drafts) {
    eatContent(draft.content);
    eatContent(draft.ai_generated_content ?? null);
    eatContent(draft.previous_content ?? null);
  }
  return out;
}

export type OrphanReport = {
  orphans: StorageEntry[];
  totalReferenced: number;
  totalInBucket: number;
  /** Total bytes recoverable (sum of orphan sizes; nulls treated as 0). */
  recoverableBytes: number;
};

export function computeOrphanReport(args: {
  drafts: Draft[];
  entries: StorageEntry[];
}): OrphanReport {
  const referenced = collectReferencedKeys(args.drafts);
  const orphans = args.entries.filter((e) => !referenced.has(e.storageKey));
  const recoverableBytes = orphans.reduce(
    (acc, o) => acc + (typeof o.bytes === "number" ? o.bytes : 0),
    0,
  );
  return {
    orphans,
    totalReferenced: referenced.size,
    totalInBucket: args.entries.length,
    recoverableBytes,
  };
}
