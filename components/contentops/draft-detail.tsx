// Engine component — presentational single-draft view. Server component.
// Renders content + metadata. No actions, no mutations.

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

export function DraftDetail({ draft }: DraftDetailProps) {
  const post = draft.content;
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
            <dd className="mt-1 text-[#1F1918]">{post.keywords.join(", ")}</dd>
          </div>
        </dl>
      </header>

      <section className="space-y-5 rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
        {post.sections.map((section, index) => (
          <div key={`${section.heading}-${index}`} className="space-y-2">
            <h2 className="text-base font-semibold text-[#1F1918]">{section.heading}</h2>
            {section.content.map((paragraph, pIndex) => (
              <p key={pIndex} className="text-sm leading-relaxed text-[#3B2F2F]/85">
                {paragraph}
              </p>
            ))}
          </div>
        ))}
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
