// Display labels and palette tones for ContentOps drafts. Engine values
// (DraftStatus, ConflictCode) stay as today; this file maps them to the
// reviewer-facing copy and Tailwind classes used across the admin UI.
//
// Engine code (lib/contentops/*) never imports this file. Wiring + components
// import it freely. When a second tenant adopts ContentOps and wants a
// different editorial voice, this is the file they fork.

import type { ConflictCode } from "@/lib/contentops/publish-types";
import type { DraftStatus } from "@/lib/contentops/drafts-store";

export const STATUS_LABELS: Record<DraftStatus, string> = {
  pending_review: "Awaiting your review",
  approved: "Approved · awaiting publish",
  scheduled: "Scheduled for publish",
  rejected: "Declined",
  published: "Live on site",
};

export const STATUS_FILTER_LABELS: Record<DraftStatus, string> = {
  pending_review: "Awaiting review",
  approved: "Approved",
  scheduled: "Scheduled",
  rejected: "Declined",
  published: "Live",
};

type StatusTone = {
  container: string;
  text: string;
  pill: string;
};

// Calm boutique palette — sage for approved, deep green for live, muted
// blue for scheduled, muted clay for declined, neutral cream for awaiting
// review.
export const STATUS_TONES: Record<DraftStatus, StatusTone> = {
  pending_review: {
    container: "border-[#3B2F2F]/12 bg-[#FBF7F3]",
    text: "text-[#3B2F2F]",
    pill: "bg-[#EFE7DE] text-[#3B2F2F]",
  },
  approved: {
    container: "border-[#2E6A41]/20 bg-[#EAF5EE]",
    text: "text-[#1E5A37]",
    pill: "bg-[#D7ECDD] text-[#1E5A37]",
  },
  scheduled: {
    container: "border-[#2F4F6A]/20 bg-[#EAF1F7]",
    text: "text-[#1E3F5A]",
    pill: "bg-[#D7E4EE] text-[#1E3F5A]",
  },
  rejected: {
    container: "border-[#6A3E31]/20 bg-[#F0EAE5]",
    text: "text-[#5B342B]",
    pill: "bg-[#E5DAD2] text-[#5B342B]",
  },
  published: {
    container: "border-[#2E6A41]/28 bg-[#D8EBE0]",
    text: "text-[#175030]",
    pill: "bg-[#C5DECD] text-[#175030]",
  },
};

export const CONFLICT_LABELS: Record<ConflictCode, string> = {
  SCHEMA_INVALID: "Article structure is incomplete.",
  SLUG_DUPLICATES_PUBLISHED: "This URL already exists on the site.",
  SLUG_DUPLICATES_OTHER_DRAFT: "Another draft uses this URL.",
  TITLE_DUPLICATES_PUBLISHED: "This title is already used by a live article.",
  CATEGORY_NO_PRODUCTS: "No products in this category for the hero image.",
  CTA_HREF_MALFORMED: "Call-to-action link looks unusual.",
  METADATA_TITLE_LENGTH: "Title may not display well in search results.",
  METADATA_DESCRIPTION_LENGTH: "Description may not display well in search results.",
};

export function getStatusLabel(status: DraftStatus): string {
  return STATUS_LABELS[status];
}

export function getStatusFilterLabel(status: DraftStatus): string {
  return STATUS_FILTER_LABELS[status];
}

export function getStatusTone(status: DraftStatus): StatusTone {
  return STATUS_TONES[status];
}

export function getConflictLabel(code: ConflictCode): string {
  return CONFLICT_LABELS[code];
}
