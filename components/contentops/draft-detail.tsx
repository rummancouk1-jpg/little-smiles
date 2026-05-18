// Engine component — presentational single-draft view. Server component.
// Reviewer-facing: status uses calm labels, technical identifiers live in
// a collapsed "Engineer details" disclosure.

import { type Draft } from "@/lib/contentops/drafts-store";
import { getStatusLabel, getStatusTone } from "@/components/contentops/labels";
import { formatAbsolute, formatRelativeTime } from "@/components/contentops/relative-time";

type DraftDetailProps = {
  draft: Draft;
};

export function DraftDetail({ draft }: DraftDetailProps) {
  const post = draft.content;
  const tone = getStatusTone(draft.status);
  return (
    <article className="space-y-6">
      <header
        className={`rounded-3xl border p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9 ${tone.container}`}
      >
        <p className={`text-xs font-medium uppercase tracking-[0.18em] ${tone.text}`}>
          {getStatusLabel(draft.status)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/75">{post.description}</p>

        <dl className="mt-6 grid grid-cols-1 gap-3 text-xs text-[#3B2F2F]/65 sm:grid-cols-3">
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Category</dt>
            <dd className="mt-1 text-[#1F1918]">{post.category}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Anchored to</dt>
            <dd className="mt-1 text-[#1F1918]">{post.relatedProductCategory}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Read time</dt>
            <dd className="mt-1 text-[#1F1918]">{post.readTime}</dd>
          </div>
          <div className="sm:col-span-3">
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
          Reads <span className="font-medium">&ldquo;{post.cta.label}&rdquo;</span>, links to the{" "}
          <span className="font-medium">{post.relatedProductCategory}</span> collection.
        </p>
      </section>

      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 text-xs text-[#3B2F2F]/72 sm:p-6">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Drafted</dt>
            <dd className="mt-1" title={draft.created_at}>
              {formatRelativeTime(draft.created_at)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Approved</dt>
            <dd className="mt-1" title={draft.approved_at ?? undefined}>
              {draft.approved_at ? formatRelativeTime(draft.approved_at) : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Live since</dt>
            <dd className="mt-1" title={draft.published_at ?? undefined}>
              {draft.published_at ? formatRelativeTime(draft.published_at) : "—"}
            </dd>
          </div>
        </dl>
        {draft.rejection_note ? (
          <div className="mt-4 rounded-2xl border border-[#6A3E31]/22 bg-[#F0EAE5] p-4 text-[#5B342B]">
            <p className="text-xs font-medium uppercase tracking-[0.12em]">Decline note</p>
            <p className="mt-1 text-sm">{draft.rejection_note}</p>
          </div>
        ) : null}
        {draft.publish_notes ? (
          <div className="mt-4 rounded-2xl border border-[#2E6A41]/20 bg-[#EAF5EE] p-4 text-[#1E5A37]">
            <p className="text-xs font-medium uppercase tracking-[0.12em]">Publish notes</p>
            <p className="mt-1 text-sm">{draft.publish_notes}</p>
          </div>
        ) : null}

        <details className="mt-5 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
            Engineer details
          </summary>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-xs text-[#3B2F2F]/72 sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em]">Draft id</dt>
              <dd className="mt-1 font-mono text-[#1F1918]">{draft.id}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em]">URL path</dt>
              <dd className="mt-1 font-mono text-[#1F1918]">/{post.slug}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em]">Created (absolute)</dt>
              <dd className="mt-1">{formatAbsolute(draft.created_at)}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em]">AI publish date</dt>
              <dd className="mt-1">{post.publishedAt}</dd>
            </div>
          </dl>
        </details>
      </section>
    </article>
  );
}
