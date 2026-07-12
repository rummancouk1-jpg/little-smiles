/**
 * ContentOps draft CLI — local-only.
 *
 * Thin wrapper over the shared drafting pipeline in
 * `lib/contentops/draft-generation.ts`. The SAME function powers the admin
 * UI's "New draft" action, so terminal and browser runs are guaranteed
 * identical — this file only parses argv, prints progress, and maps failures
 * to an exit code.
 *
 * Generates a single blog draft via Anthropic, validates against the Zod
 * BlogPost schema, and persists it to `contentops_drafts` with status
 * `pending_review`. Never auto-publishes; the reviewer approves every draft.
 *
 * Usage:
 *   npm run contentops:draft -- "<topic>"
 *
 * Required env:
 *   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Prerequisite: supabase/contentops-schema.sql must already be applied to the
 * target Supabase database.
 */
import {
  DraftGenerationError,
  generateDraftForTopic,
} from "../lib/contentops/draft-generation";

const LOG_PREFIX = "[contentops-draft]";

function fail(message: string): never {
  console.error(`${LOG_PREFIX} ${message}`);
  process.exit(1);
}

function parseTopic(): string {
  const topic = process.argv[2]?.trim();
  if (!topic) {
    fail('Usage: npm run contentops:draft -- "<topic>"');
  }
  return topic;
}

async function main() {
  const topic = parseTopic();

  let result;
  try {
    result = await generateDraftForTopic(topic, {
      onProgress: (message) => console.log(`${LOG_PREFIX} ${message}`),
    });
  } catch (err) {
    if (err instanceof DraftGenerationError) {
      if (err.code === "schema_validation" && err.details?.issues) {
        console.error(`${LOG_PREFIX} Zod validation failed for model output:`);
        console.error(JSON.stringify(err.details.issues, null, 2));
      }
      fail(err.message);
    }
    throw err;
  }

  if (result.critique) {
    for (const f of result.critique.flags) {
      console.log(`  [${f.severity}/${f.category}] ${f.location}: ${f.note}`);
    }
  }
  for (const warning of result.warnings) {
    console.log(`${LOG_PREFIX} Note: ${warning}`);
  }

  console.log(
    `${LOG_PREFIX} OK. id=${result.id} slug=${result.slug} ` +
      `title="${result.draft.title}" (${result.validLinkCount} valid link(s))`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  fail(message);
});
