/**
 * ContentOps metadata-repair CLI — local-only.
 *
 * Runs the SAME Haiku metadata-repair pass the drafting pipeline uses, but on an
 * EXISTING draft (by id or slug): brings the SEO title (≤70), meta description
 * (80-160), keywords (≥3), and slug shape within band, then writes the repaired
 * content back. Used to repair drafts that pre-date the pass — e.g. the one-off
 * "Best Swaddle Fabrics" title trim.
 *
 * It repairs METADATA only — it never expands the body or changes the topic, so
 * a thin draft stays thin (that's the Branch-2 expansion pass). The draft keeps
 * its status (a pending draft stays pending).
 *
 * Usage:
 *   npm run contentops:repair-metadata -- "<draft-id-or-slug>"
 *
 * Required env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { repairDraftMetadata } from "../lib/contentops/draft-generation";
import {
  findDraftBySlug,
  getDraftById,
  updateDraftContent,
  type Draft,
} from "../lib/contentops/drafts-store";
import { assessMetadata } from "../lib/contentops/metadata-repair";

const LOG_PREFIX = "[contentops-repair-metadata]";

function fail(message: string): never {
  console.error(`${LOG_PREFIX} ${message}`);
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadDraft(idOrSlug: string): Promise<Draft | null> {
  if (UUID_RE.test(idOrSlug)) return getDraftById(idOrSlug);
  return findDraftBySlug(idOrSlug);
}

async function main() {
  const idOrSlug = process.argv[2]?.trim();
  if (!idOrSlug) fail('Usage: npm run contentops:repair-metadata -- "<draft-id-or-slug>"');

  const draft = await loadDraft(idOrSlug);
  if (!draft) fail(`No draft found for "${idOrSlug}".`);
  if (draft.status === "published") fail("Published drafts cannot be edited.");

  const before = assessMetadata(draft.content);
  console.log(`${LOG_PREFIX} ${draft.slug} (${draft.status})`);
  console.log(`${LOG_PREFIX} before: title ${draft.content.title.length} chars, description ${draft.content.description.length} chars, ${draft.content.keywords.length} keywords`);
  if (before.allOk) {
    console.log(`${LOG_PREFIX} metadata already within band — nothing to repair.`);
    return;
  }
  console.log(`${LOG_PREFIX} out of band: ${before.issues.join("; ")}`);

  const repaired = await repairDraftMetadata(draft.content, {
    onProgress: (m) => console.log(`${LOG_PREFIX} ${m}`),
  });

  const unchanged =
    repaired.title === draft.content.title &&
    repaired.description === draft.content.description &&
    repaired.slug === draft.content.slug &&
    repaired.keywords.join("") === draft.content.keywords.join("");
  if (unchanged) {
    console.log(`${LOG_PREFIX} repair produced no change (model returned equivalent fields).`);
    return;
  }

  await updateDraftContent(draft.id, repaired);
  const after = assessMetadata(repaired);
  console.log(`${LOG_PREFIX} AFTER: title "${repaired.title}" (${repaired.title.length} chars), description ${repaired.description.length} chars, ${repaired.keywords.length} keywords`);
  console.log(`${LOG_PREFIX} in band now: ${after.allOk ? "yes" : "no — " + after.issues.join("; ")}`);
  console.log(`${LOG_PREFIX} done.`);
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : "Unknown error");
});
