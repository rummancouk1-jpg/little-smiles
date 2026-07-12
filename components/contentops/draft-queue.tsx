// Engine component — presentational draft queue. Server component.
// Renders premium queue cards with status badges, derived signal badges
// (missing image, thin content, missing internal links, missing meta),
// and filter pills. Wiring layer supplies the hrefs.

import Link from "next/link";

import {
  PipelineOverview,
  STATUS_TONE,
  StatusPill,
} from "@/components/contentops/contentops-ui";
import { PublishSafetyPill } from "@/components/contentops/publish-safety-card";
import { validateDraft, type DraftBadge } from "@/lib/contentops/draft-validation";
import {
  type Draft,
  type DraftStatus,
  type DraftStatusCounts,
} from "@/lib/contentops/drafts-store";
import {
  deriveHandoffLabels,
  type HandoffLabel,
} from "@/lib/contentops/handoff-labels";
import { computePublishSafetyScore } from "@/lib/contentops/publish-score";
import { assessQualityBar } from "@/lib/contentops/quality-bar";

type DraftQueueProps = {
  /** Visible drafts after applying the activeStatus filter. */
  drafts: Draft[];
  /** Total counts from the full drafts table — independent of the active filter. */
  counts: DraftStatusCounts;
  activeStatus: DraftStatus | "all";
  baseHref: string;
  detailHref: (id: string) => string;
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Token-backed tint + tone — theme-aware, replaces the old literal hex. */
function badgeToneClass(severity: DraftBadge["severity"]): string {
  if (severity === "critical") return "bg-emphasis-berry-tint text-tone-danger";
  if (severity === "warning") return "bg-tone-amber-tint text-tone-amber";
  if (severity === "info") return "bg-tone-blue-tint text-tone-blue";
  return "bg-tone-green-tint text-tone-green-deep";
}

function handoffToneClass(tone: HandoffLabel["tone"]): string {
  if (tone === "positive") return "bg-tone-green-tint text-tone-green-deep";
  if (tone === "warning") return "bg-tone-amber-tint text-tone-amber";
  if (tone === "critical") return "bg-emphasis-berry-tint text-tone-danger";
  return "bg-tone-blue-tint text-tone-blue";
}

export function DraftQueue({ drafts, counts, activeStatus, baseHref, detailHref }: DraftQueueProps) {
  return (
    <section className="space-y-6">
      <PipelineOverview counts={counts} baseHref={baseHref} activeStatus={activeStatus} />

      {drafts.length === 0 ? (
        <article className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-7 text-sm text-ink-base/72 shadow-card-rest sm:p-9">
          No drafts{" "}
          {activeStatus === "all"
            ? "yet — use “New draft” above to generate one."
            : `in ${STATUS_TONE[activeStatus as DraftStatus].label.toLowerCase()}.`}
        </article>
      ) : (
        <div className="grid gap-3">
          {drafts.map((draft) => {
            const validation = validateDraft(draft);
            const safetyScore = computePublishSafetyScore(draft, { validation });
            const handoff = deriveHandoffLabels({
              verdict: safetyScore.verdict,
              badges: validation.badges,
            });
            // Interim-honesty (Branch 1): a draft can read publish-score 100 after
            // metadata repair yet still be genuinely thin, because the full-length
            // expansion pass is Branch 2. Flag that plainly so a green score never
            // reads as "fully ready to publish".
            const quality = assessQualityBar(draft);
            return (
              <article
                key={draft.id}
                className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-lift sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={draft.status} />
                      <span className="text-[11px] text-ink-base/60 tabular-nums">
                        {validation.wordCount} words · {validation.sectionCount} sections
                      </span>
                    </div>
                    <Link
                      href={detailHref(draft.id)}
                      className="mt-2 inline-block font-heading text-lg font-semibold text-ink-strong underline-offset-2 hover:underline"
                    >
                      {draft.content.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-ink-base/60">{draft.slug}</p>
                  </div>
                  <div className="text-right text-[11px] text-ink-base/60">
                    <p className="uppercase tracking-wide">Created</p>
                    <p className="mt-0.5 text-ink-strong">{formatDateTime(draft.created_at)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {quality.belowBar ? (
                    <span
                      className="inline-flex rounded-full bg-tone-amber-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-tone-amber"
                      title={`Below the full quality bar — pending expansion (Branch 2): ${quality.reasons.join(" · ")}. Do not publish as fully-ready yet.`}
                    >
                      Below quality bar · pending expansion
                    </span>
                  ) : null}
                  <PublishSafetyPill score={safetyScore} />
                  {handoff.map((label) => (
                    <span
                      key={`h-${label.key}`}
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                        handoffToneClass(label.tone),
                      ].join(" ")}
                      title={label.detail}
                    >
                      {label.label}
                    </span>
                  ))}
                  {validation.badges.map((badge) => (
                    <span
                      key={badge.key}
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        badgeToneClass(badge.severity),
                      ].join(" ")}
                      title={badge.detail}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-base/10 pt-3">
                  <Link
                    href={detailHref(draft.id)}
                    className="rounded-full bg-ink-walnut px-3.5 py-1.5 text-xs font-medium text-ink-foreground hover:bg-ink-espresso"
                  >
                    Review draft
                  </Link>
                  {draft.status !== "published" ? (
                    <Link
                      href={`${detailHref(draft.id)}/edit`}
                      className="rounded-full border border-tone-blue/30 bg-tone-blue-tint px-3.5 py-1.5 text-xs font-medium text-tone-blue hover:opacity-90"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {validation.badges.some((b) => b.severity === "warning" || b.severity === "critical") ? (
                    <Link
                      href={`${detailHref(draft.id)}/improve`}
                      className="rounded-full border border-tone-amber/30 bg-tone-amber-tint px-3.5 py-1.5 text-xs font-medium text-tone-amber hover:opacity-90"
                    >
                      Improve →
                    </Link>
                  ) : null}
                  {draft.status === "approved" ? (
                    <Link
                      href={`${detailHref(draft.id)}/prepare-publish`}
                      className="rounded-full border border-tone-green/30 bg-tone-green-tint px-3.5 py-1.5 text-xs font-medium text-tone-green-deep hover:opacity-90"
                    >
                      Publish →
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
