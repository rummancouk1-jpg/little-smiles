/**
 * ContentOps full-length expansion CLI — local-only.
 *
 * Runs the SAME Sonnet 5 expansion pass the drafting pipeline uses, but on an
 * EXISTING draft (by id or slug): brings a thin body up to the quality bar
 * (~900-1100 words, 5-7 sections, 3-5 FAQ). Used to backfill drafts that
 * pre-date the pass — e.g. the "Best Swaddle Fabrics" draft.
 *
 * SAFE BY DEFAULT — DRY RUN unless `--apply` is passed: it prints the proposed
 * expansion (word / section / FAQ counts + before/after publish-score) WITHOUT
 * writing. Review that, then re-run with `--apply` to persist to the live row.
 * The draft keeps its status and topic; only the body/FAQ grow.
 *
 * Usage:
 *   npm run contentops:expand-draft -- "<draft-id-or-slug>"           # dry run (no write)
 *   npm run contentops:expand-draft -- "<draft-id-or-slug>" --apply   # write to the live row
 *
 * Required env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { expandDraftBody } from "../lib/contentops/draft-generation";
import {
  findDraftBySlug,
  getDraftById,
  updateDraftContent,
  type Draft,
} from "../lib/contentops/drafts-store";
import { validateDraft } from "../lib/contentops/draft-validation";
import { computePublishSafetyScore } from "../lib/contentops/publish-score";

const LOG_PREFIX = "[contentops-expand-draft]";

function fail(message: string): never {
  console.error(`${LOG_PREFIX} ${message}`);
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadDraft(idOrSlug: string): Promise<Draft | null> {
  if (UUID_RE.test(idOrSlug)) return getDraftById(idOrSlug);
  return findDraftBySlug(idOrSlug);
}

function scoreOf(draft: Draft): number {
  return computePublishSafetyScore(draft, { validation: validateDraft(draft) }).score;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const idOrSlug = args.find((a) => !a.startsWith("--"))?.trim();
  if (!idOrSlug) fail('Usage: npm run contentops:expand-draft -- "<draft-id-or-slug>" [--apply]');

  const draft = await loadDraft(idOrSlug);
  if (!draft) fail(`No draft found for "${idOrSlug}".`);
  if (draft.status === "published") fail("Published drafts cannot be edited.");

  console.log(`${LOG_PREFIX} ${draft.slug} (${draft.status}) — ${apply ? "APPLY (will write)" : "DRY RUN (no write)"}`);
  const scoreBefore = scoreOf(draft);

  const { post, before, after } = await expandDraftBody(draft.content, {
    onProgress: (m) => console.log(`${LOG_PREFIX} ${m}`),
  });

  const scoreAfter = scoreOf({ ...draft, content: post });
  console.log(`${LOG_PREFIX} ── proposed expansion ──`);
  console.log(`${LOG_PREFIX} words:    ${before.wordCount} -> ${after.wordCount}`);
  console.log(`${LOG_PREFIX} sections: ${before.sectionCount} -> ${after.sectionCount}`);
  console.log(`${LOG_PREFIX} faq:      ${before.faqCount} -> ${after.faqCount}`);
  console.log(`${LOG_PREFIX} publish-score: ${scoreBefore} -> ${scoreAfter}`);
  console.log(`${LOG_PREFIX} quality bar: ${after.belowBar ? "STILL BELOW — " + after.gaps.join("; ") : "PASSED"}`);
  console.log(`${LOG_PREFIX} section headings: ${post.sections.map((s) => s.heading).join(" | ")}`);

  if (!apply) {
    console.log(`${LOG_PREFIX} DRY RUN — nothing written. Re-run with --apply to persist this to the live row.`);
    return;
  }

  await updateDraftContent(draft.id, post);
  console.log(`${LOG_PREFIX} WRITTEN to the live row (${draft.id}). Status unchanged (${draft.status}).`);
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : "Unknown error");
});
