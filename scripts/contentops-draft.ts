/**
 * ContentOps draft CLI — local-only.
 *
 * Thin wrapper around lib/contentops/draft-generation.ts. Provides
 * ergonomic CLI argument parsing + a Supabase connectivity pre-flight
 * so a misconfigured local env fails fast before spending Anthropic
 * tokens. The actual generation, validation, and persistence logic
 * lives in the shared library so the in-app API route behaves
 * identically.
 *
 * Usage:
 *   npm run contentops:draft -- "<topic>"
 *
 * Required env:
 *   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Prerequisite: supabase/contentops-schema.sql must already be applied
 * to the target Supabase database.
 */

import { generateDraftFromTopic } from "../lib/contentops/draft-generation";
import { getSupabaseAdminClient } from "../lib/supabase-admin";

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

function assertEnv() {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    fail("ANTHROPIC_API_KEY is required. Set it in your local environment.");
  }
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
}

async function pingSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) {
    fail("Supabase client could not be initialized. Check env vars.");
  }
  const { error } = await client
    .from("contentops_drafts")
    .select("id", { count: "exact", head: true });
  if (error) {
    fail(
      `Supabase connectivity check failed: ${error.message}. ` +
        "Has supabase/contentops-schema.sql been applied to this database?",
    );
  }
}

async function main() {
  const topic = parseTopic();
  assertEnv();
  await pingSupabase();

  console.log(`${LOG_PREFIX} Generating draft for: "${topic}"`);
  const result = await generateDraftFromTopic(topic);
  console.log(
    `${LOG_PREFIX} OK. id=${result.id} slug=${result.slug} title="${result.title}"`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
});
