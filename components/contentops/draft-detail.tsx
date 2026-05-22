// Engine component — presentational single-draft view. Server component.
// Renders admin diagnostics (status, badges, SEO metadata, schema
// readiness, audit footer). The reader-facing body view lives in
// <WebsitePreview/>; the hero-image picker lives in <HeroImagePanel/> —
// both are rendered by the wiring layer so this file stays diagnostic-only.

import { validateDraft, type DraftBadge } from "@/lib/contentops/draft-validation";
import { type Draft } from "@/lib/contentops/drafts-store";

type DraftDetailProps = {
  draft: Draft;
};

const STATUS_LABELS = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
} as const;

function formatDateTime(value: string | null): string {
  if (!value) return "—";
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

function severityClass(severity: DraftBadge["severity"]): string {
  if (severity === "critical") return "bg-[#F8E8EA] text-[#8A2F40]";
  if (severity === "warning") return "bg-[#FBEEDE] text-[#7A4A12]";
  if (severity === "info") return "bg-[#E7EEF7] text-[#1F3F66]";
  return "bg-[#E7F4EA] text-[#2E6A41]";
}

function BadgeChip({ badge }: { badge: DraftBadge }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        severityClass(badge.severity),
      ].join(" ")}
      title={badge.detail}
    >
      {badge.label}
    </span>
  );
}

function lengthClass(value: number, min: number, max: number): string {
  if (value === 0) return "bg-[#F8E8EA] text-[#8A2F40]";
  if (value < min || value > max) return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#E7F4EA] text-[#2E6A41]";
}

const TITLE_MIN = 30;
const TITLE_MAX = 70;
const DESC_MIN = 80;
const DESC_MAX = 160;

export function DraftDetail({ draft }: DraftDetailProps) {
  const post = draft.content;
  const validation = validateDraft(draft);

  return (
    <article className="space-y-6">
      <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/55">
          {STATUS_LABELS[draft.status]}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/75">{post.description}</p>

        {validation.badges.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {validation.badges.map((badge) => (
              <BadgeChip key={badge.key} badge={badge} />
            ))}
          </div>
        ) : null}

        <dl className="mt-6 grid grid-cols-1 gap-3 text-xs text-[#3B2F2F]/65 sm:grid-cols-2">
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Slug</dt>
            <dd className="mt-1 font-mono text-[#1F1918]">{post.slug}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Category</dt>
            <dd className="mt-1 text-[#1F1918]">{post.category}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Related product category</dt>
            <dd className="mt-1 text-[#1F1918]">{post.relatedProductCategory}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Read time</dt>
            <dd className="mt-1 text-[#1F1918]">{post.readTime}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Planned publish date</dt>
            <dd className="mt-1 text-[#1F1918]">{post.publishedAt}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Keywords</dt>
            <dd className="mt-1 text-[#1F1918]">{post.keywords.join(", ") || "—"}</dd>
          </div>
        </dl>
      </header>

      {/* SEO metadata block */}
      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">SEO metadata</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#3B2F2F]/55">Title length</p>
            <p className="mt-1 text-sm font-semibold text-[#1F1918] tabular-nums">
              <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${lengthClass(post.title.length, TITLE_MIN, TITLE_MAX)}`}>
                {post.title.length}
              </span>
              target {TITLE_MIN}–{TITLE_MAX}
            </p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#3B2F2F]/55">Description length</p>
            <p className="mt-1 text-sm font-semibold text-[#1F1918] tabular-nums">
              <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${lengthClass(post.description.length, DESC_MIN, DESC_MAX)}`}>
                {post.description.length}
              </span>
              target {DESC_MIN}–{DESC_MAX}
            </p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#3B2F2F]/55">Keywords</p>
            <p className="mt-1 text-sm font-semibold text-[#1F1918] tabular-nums">
              <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${post.keywords.length >= 3 ? "bg-[#E7F4EA] text-[#2E6A41]" : "bg-[#FBEEDE] text-[#7A4A12]"}`}>
                {post.keywords.length}
              </span>
              target ≥ 3
            </p>
          </article>
        </div>
      </section>

      {/* Schema readiness */}
      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">Schema readiness</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          <li className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/82">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${post.title.length >= 10 ? "bg-[#E7F4EA] text-[#2E6A41]" : "bg-[#F8E8EA] text-[#8A2F40]"}`}>
              {post.title.length >= 10 ? "ok" : "missing"}
            </span>
            <code className="font-mono">BlogPosting.headline</code>
          </li>
          <li className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/82">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${post.description.length >= 50 ? "bg-[#E7F4EA] text-[#2E6A41]" : "bg-[#FBEEDE] text-[#7A4A12]"}`}>
              {post.description.length >= 50 ? "ok" : "weak"}
            </span>
            <code className="font-mono">BlogPosting.description</code>
          </li>
          <li className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/82">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt) ? "bg-[#E7F4EA] text-[#2E6A41]" : "bg-[#F8E8EA] text-[#8A2F40]"}`}>
              {/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt) ? "ok" : "invalid"}
            </span>
            <code className="font-mono">BlogPosting.datePublished</code>
          </li>
          <li className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/82">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${validation.hasAnchorProduct || draft.hero_image_path ? "bg-[#E7F4EA] text-[#2E6A41]" : "bg-[#FBEEDE] text-[#7A4A12]"}`}>
              {validation.hasAnchorProduct || draft.hero_image_path ? "ok" : "fallback"}
            </span>
            <code className="font-mono">BlogPosting.image</code>
          </li>
          <li className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/82">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${post.keywords.length > 0 ? "bg-[#E7F4EA] text-[#2E6A41]" : "bg-[#E7EEF7] text-[#1F3F66]"}`}>
              {post.keywords.length > 0 ? "ok" : "empty"}
            </span>
            <code className="font-mono">BlogPosting.keywords</code>
          </li>
          <li className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/82">
            <span className="mr-2 rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#2E6A41]">
              ok
            </span>
            <code className="font-mono">BlogPosting.publisher</code> (Org)
          </li>
        </ul>
      </section>

      {/* Body stats — diagnostics summary; reader preview is rendered separately */}
      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 text-xs text-[#3B2F2F]/65 sm:p-6">
        <p className="font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">Body stats</p>
        <p className="mt-2 text-[#1F1918]">
          <strong>{validation.wordCount}</strong> words ·{" "}
          <strong>{validation.sectionCount}</strong> sections ·{" "}
          <strong>{validation.internalLinkCount}</strong> internal link references
        </p>
        <p className="mt-1 text-[#3B2F2F]/60">
          Body content is rendered in the Website preview section below — that view mirrors the public blog
          page&apos;s typography exactly.
        </p>
      </section>

      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-5 text-sm sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Call to action
        </p>
        <p className="mt-2 text-[#1F1918]">
          <span className="font-medium">{post.cta.label}</span>
          <span className="ml-2 font-mono text-xs text-[#3B2F2F]/65">→ {post.cta.href}</span>
        </p>
      </section>

      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 text-xs text-[#3B2F2F]/72 sm:p-6">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Draft id</dt>
            <dd className="mt-1 font-mono text-[#1F1918]">{draft.id}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Created</dt>
            <dd className="mt-1">{formatDateTime(draft.created_at)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Approved at</dt>
            <dd className="mt-1">{formatDateTime(draft.approved_at)}</dd>
          </div>
        </dl>
        {draft.rejection_note ? (
          <div className="mt-4 rounded-2xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-4 text-[#5E1C29]">
            <p className="text-xs font-medium uppercase tracking-[0.12em]">Rejection note</p>
            <p className="mt-1 text-sm">{draft.rejection_note}</p>
          </div>
        ) : null}
      </section>
    </article>
  );
}
