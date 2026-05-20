// Lightweight recipient-list helpers. Backward-compatible with the single-
// recipient world: the storage column remains a single TEXT field, the
// engine API stays string-typed, and a value with no commas behaves
// exactly as before.
//
// Format on the wire and in storage: zero-or-more comma-separated email
// addresses, optionally surrounded by whitespace. We never persist the
// parsed list — round-tripping through a single string keeps DB shape
// untouched.
//
// Validation here is intentionally simple: trim, drop empties, dedupe
// case-insensitively, run each value through a single email regex. We
// don't try to be RFC-perfect; we just refuse anything obviously broken
// so a typo doesn't reach Resend.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecipientParseResult =
  | { ok: true; emails: string[] }
  | { ok: false; invalid: string[] };

/**
 * Parse a comma-separated recipient string. Returns the deduplicated,
 * trimmed list when every entry validates; otherwise returns the list of
 * invalid entries the caller can surface to the operator.
 *
 * Empty input is treated as zero recipients (ok=true, emails=[]). The
 * caller decides whether zero recipients is allowed in its context.
 */
export function parseRecipientList(raw: string | null | undefined): RecipientParseResult {
  if (!raw) return { ok: true, emails: [] };
  const trimmedAll = raw.trim();
  if (trimmedAll.length === 0) return { ok: true, emails: [] };

  const parts = trimmedAll
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const invalid: string[] = [];
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of parts) {
    if (!EMAIL_RE.test(part)) {
      invalid.push(part);
      continue;
    }
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(part);
  }
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, emails };
}

/**
 * Render a normalized recipient list back into the storage shape.
 * Single value renders without trailing whitespace; multi-value uses
 * ", " separator. Empty list → empty string, which the engine treats
 * as "no recipient".
 */
export function formatRecipientList(emails: string[]): string {
  return emails.join(", ");
}

/**
 * Convenience: normalize a raw operator-entered string. Returns either
 * the canonical stored form or null when the input is empty. Throws
 * with a clear, single-string message if any entry is invalid so the
 * caller can surface it directly.
 */
export function normalizeRecipientString(raw: string | null | undefined): string | null {
  const parsed = parseRecipientList(raw);
  if (!parsed.ok) {
    throw new Error(
      `Invalid email${parsed.invalid.length > 1 ? "s" : ""}: ${parsed.invalid.join(", ")}`,
    );
  }
  if (parsed.emails.length === 0) return null;
  return formatRecipientList(parsed.emails);
}
