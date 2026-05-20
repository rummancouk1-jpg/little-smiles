// Operator-friendly error translation for Supabase/PostgREST responses.
//
// PostgREST returns code `PGRST205` ("Could not find the table 'public.X'
// in the schema cache") when a table referenced by the client doesn't
// exist on the project — usually because the migration hasn't been run
// yet. The raw message is correct but confusing for non-DB operators, so
// we rewrite it inline with a concrete fix-it pointer.
//
// Anything outside this single failure mode passes through unchanged so
// real errors keep their original signal.

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const TABLE_TO_MIGRATION: Record<string, string> = {
  contentops_drafts: "supabase/contentops-schema.sql",
  contentops_topics: "supabase/contentops-topics-schema.sql",
  contentops_notification_preferences: "supabase/contentops-notifications-schema.sql",
};

function migrationFor(table: string): string | null {
  return TABLE_TO_MIGRATION[table] ?? null;
}

export function isMissingTableError(err: SupabaseLikeError | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "PGRST205") return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("could not find the table") && msg.includes("schema cache");
}

/**
 * Returns operator-friendly copy for a Supabase error if it represents a
 * missing-table condition, otherwise null. The caller decides whether to
 * use the friendly message or fall through to the original.
 */
export function describeMissingTable(
  err: SupabaseLikeError | null | undefined,
  fallbackTable?: string,
): string | null {
  if (!isMissingTableError(err)) return null;
  const raw = err?.message ?? "";
  const match = raw.match(/'?public\.([a-z0-9_]+)'?/i);
  const table = match?.[1] ?? fallbackTable;
  const migration = table ? migrationFor(table) : null;
  if (table && migration) {
    return `Table public.${table} is missing. Apply ${migration} in the Supabase SQL editor (idempotent — safe to re-run).`;
  }
  if (table) {
    return `Table public.${table} is missing. Apply the matching migration in supabase/ from the Supabase SQL editor.`;
  }
  return "A required ContentOps table is missing. Apply the migrations in supabase/ from the Supabase SQL editor.";
}
