// Calm relative-time formatter for reviewer-facing surfaces. Falls back to
// an absolute date when the gap exceeds a week. No locale assumptions
// beyond en-PK formatting.

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) {
    // Future timestamps fall back to absolute formatting.
    return formatAbsolute(d);
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatAbsolute(d);
}

export function formatAbsolute(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Forward-looking counterpart to formatRelativeTime. Returns calm "in 2d /
// in 4h" hints for upcoming timestamps. Past or invalid inputs fall back
// to "—" rather than producing "ago" — call formatRelativeTime when the
// timestamp is expected to be in the past.
export function formatRelativeFuture(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const delta = d.getTime() - Date.now();
  if (delta <= 0) return "now";

  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 14) return `in ${days}d`;

  return formatAbsolute(d);
}
