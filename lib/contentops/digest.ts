// Pure engine for the ContentOps reviewer digest. The cron route composes
// this engine with the project's Resend wiring — engine code has no
// knowledge of which email provider is used at runtime.

import { listDrafts, type Draft } from "@/lib/contentops/drafts-store";

export type DigestDraftSummary = {
  id: string;
  slug: string;
  title: string;
  category: string;
  createdAt: string;
};

export type DigestPlan = {
  pendingCount: number;
  drafts: DigestDraftSummary[];
  shouldSend: boolean;
  skippedReason?: "empty_queue";
};

const MAX_DRAFTS_IN_DIGEST = 25;

/**
 * Build the reviewer digest payload from the live `contentops_drafts`
 * table. Throws if Supabase is unreachable so the cron route can decide
 * whether to retry / record failure.
 *
 * Honours the locked rule: when no drafts are pending review, returns a
 * plan with `shouldSend = false` so the route can skip the email send
 * entirely and avoid notification fatigue.
 */
export async function buildDigestPlan(): Promise<DigestPlan> {
  const pending = await listDrafts("pending_review");
  const summaries: DigestDraftSummary[] = pending
    .slice(0, MAX_DRAFTS_IN_DIGEST)
    .map((draft: Draft) => ({
      id: draft.id,
      slug: draft.slug,
      title: draft.content.title,
      category: draft.content.category,
      createdAt: draft.created_at,
    }));

  if (pending.length === 0) {
    return {
      pendingCount: 0,
      drafts: [],
      shouldSend: false,
      skippedReason: "empty_queue",
    };
  }

  return {
    pendingCount: pending.length,
    drafts: summaries,
    shouldSend: true,
  };
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateForReviewer(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString("en-PK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export type DigestEmail = {
  subject: string;
  html: string;
  text: string;
};

export function renderDigestEmail(plan: DigestPlan, options: { baseUrl: string }): DigestEmail {
  const noun = plan.pendingCount === 1 ? "draft" : "drafts";
  const subject = `Little Smiles — ${plan.pendingCount} ${noun} pending review`;
  const safeBase = options.baseUrl.replace(/\/+$/, "");
  const queueUrl = `${safeBase}/admin/contentops?status=pending_review`;

  const rows = plan.drafts
    .map((draft) => {
      const detailUrl = `${safeBase}/admin/contentops/${draft.id}`;
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #efe6de;vertical-align:top">
            <a href="${escapeHtml(detailUrl)}" style="color:#2F2624;text-decoration:none;font-weight:600">
              ${escapeHtml(draft.title)}
            </a>
            <div style="margin-top:4px;font-size:12px;color:#5a4b47">
              ${escapeHtml(draft.category)} · /${escapeHtml(draft.slug)}
            </div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #efe6de;font-size:12px;color:#5a4b47;white-space:nowrap;vertical-align:top">
            ${escapeHtml(formatDateForReviewer(draft.createdAt))}
          </td>
        </tr>`;
    })
    .join("");

  const truncationNote =
    plan.pendingCount > plan.drafts.length
      ? `<p style="margin:16px 0 0;font-size:12px;color:#5a4b47">Showing the latest ${plan.drafts.length} of ${plan.pendingCount}. Open the queue to see the rest.</p>`
      : "";

  const html = `
    <div style="font-family:Arial,sans-serif;background:#fbf4ee;padding:24px;color:#231b1a;line-height:1.6">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #efe6de;border-radius:14px;overflow:hidden">
        <div style="padding:18px 22px;background:#fbf4ee;border-bottom:1px solid #f0e7df">
          <h2 style="margin:0;font-size:18px;color:#1f1918">Drafts pending your review</h2>
          <p style="margin:6px 0 0;font-size:13px;color:#4a3f3d">Little Smiles ContentOps</p>
        </div>
        <div style="padding:18px 22px">
          <p style="margin:0 0 12px">There ${plan.pendingCount === 1 ? "is" : "are"} <strong>${plan.pendingCount}</strong> ${noun} waiting for review.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
          ${truncationNote}
          <p style="margin:20px 0 0">
            <a href="${escapeHtml(queueUrl)}" style="display:inline-block;background:#2F2624;color:#F6F1EC;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:500;font-size:14px">
              Open review queue
            </a>
          </p>
        </div>
      </div>
    </div>
  `;

  const textLines = [
    `Little Smiles — ${plan.pendingCount} ${noun} pending review`,
    "",
    ...plan.drafts.map((draft) => `- ${draft.title} (${draft.category}) /${draft.slug}`),
    "",
    `Open the queue: ${queueUrl}`,
  ];

  return {
    subject,
    html,
    text: textLines.join("\n"),
  };
}
