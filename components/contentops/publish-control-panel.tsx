"use client";

// Publishing control panel. Operator-friendly layout:
//
//   1. Summary header — title, slug, status, readiness, hero preview,
//      word count, metadata, schema, internal-link count
//   2. Final publish checklist — deterministic, derivation-explained
//   3. Publication output — clean form-style summary of the final fields
//   4. PUBLISH — one-click, live from the admin (server re-validates; any
//      error-severity conflict refuses). The human gate is the approve
//      step that precedes this page.
//   5. Advanced (collapsed) — resolved BlogPost JSON + legacy diff text
//
// JSON / diff text remain available with copy-to-clipboard as a fallback,
// but are no longer part of the publish path.

import Image from "next/image";
import { useState, useTransition } from "react";

import { type DraftBadge } from "@/lib/contentops/draft-validation";
import type { PublishSafetyVerdict } from "@/lib/contentops/publish-score";
import type { Conflict, PublishPreparation } from "@/lib/contentops/publish-types";

type Props = {
  preparation: PublishPreparation;
  validation: {
    badges: DraftBadge[];
    wordCount: number;
    sectionCount: number;
    internalLinkCount: number;
    hasAnchorProduct: boolean;
    anchorImagePath: string | null;
    publishReady: boolean;
  };
  /** Auto-resolved fallback (anchor product) — used when the draft has no override. */
  fallbackHeroImagePath: string | null;
  /** Unified readiness verdict — drives the summary pill so the panel agrees with the banner. */
  readinessVerdict: PublishSafetyVerdict;
  /** POST endpoint that publishes this draft live (admin-authed). */
  publishHref: string;
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

const TITLE_MIN = 30;
const TITLE_MAX = 70;
const DESC_MIN = 80;
const DESC_MAX = 160;
const MIN_WORDS = 350;
const MIN_KEYWORDS = 3;

type ChecklistItem = {
  key: string;
  label: string;
  state: "ok" | "warn" | "fail";
  detail: string;
};

function buildChecklist(p: Props): ChecklistItem[] {
  const post = p.preparation.insertionPreview;
  const out: ChecklistItem[] = [];

  const heroState: ChecklistItem["state"] = post.heroImage
    ? "ok"
    : p.fallbackHeroImagePath
      ? "warn"
      : "fail";
  out.push({
    key: "hero",
    label: "Hero image selected",
    state: heroState,
    detail: post.heroImage
      ? `Reviewer override: ${post.heroImage}`
      : p.fallbackHeroImagePath
        ? `Auto-resolved fallback: ${p.fallbackHeroImagePath}`
        : "No hero image and no fallback — JSON-LD will fall back to brand OG.",
  });

  out.push({
    key: "schema",
    label: "Blog schema valid",
    state: p.preparation.validation.schemaValid ? "ok" : "fail",
    detail: p.preparation.validation.schemaValid
      ? "Draft content matches the BlogPost schema."
      : p.preparation.validation.schemaErrors.join("; ") || "Schema validation failed.",
  });

  const titleOk = post.title.length >= TITLE_MIN && post.title.length <= TITLE_MAX;
  const descOk = post.description.length >= DESC_MIN && post.description.length <= DESC_MAX;
  const kwOk = post.keywords.length >= MIN_KEYWORDS;
  const metaOk = titleOk && descOk && kwOk;
  out.push({
    key: "metadata",
    label: "Metadata within target ranges",
    state: metaOk ? "ok" : "warn",
    detail: [
      `title ${post.title.length} (target ${TITLE_MIN}–${TITLE_MAX})`,
      `description ${post.description.length} (target ${DESC_MIN}–${DESC_MAX})`,
      `keywords ${post.keywords.length} (target ≥ ${MIN_KEYWORDS})`,
    ].join(" · "),
  });

  out.push({
    key: "depth",
    label: "Content depth acceptable",
    state: p.validation.wordCount >= MIN_WORDS && p.validation.sectionCount >= 3 ? "ok" : "warn",
    detail: `${p.validation.wordCount} words across ${p.validation.sectionCount} section(s); target ≥ ${MIN_WORDS} words, ≥ 3 sections.`,
  });

  const internalOk = p.validation.internalLinkCount > 0;
  out.push({
    key: "internal",
    label: "Internal link present",
    state: internalOk ? "ok" : "warn",
    detail: internalOk
      ? `${p.validation.internalLinkCount} internal link reference(s) detected in body or CTA.`
      : "Body/CTA contains no /shop/<slug>, /blog/<slug>, or /shop?category=… references.",
  });

  const ctaOk = /^\/shop\?category=.+$/.test(post.cta.href) && post.cta.label.length > 0;
  out.push({
    key: "cta",
    label: "CTA present and well-formed",
    state: ctaOk ? "ok" : "warn",
    detail: ctaOk
      ? `"${post.cta.label}" → ${post.cta.href}`
      : `CTA href "${post.cta.href}" does not match the expected /shop?category=… pattern.`,
  });

  const errors = p.preparation.conflicts.filter((c) => c.severity === "error");
  out.push({
    key: "jsonld",
    label: "JSON-LD ready",
    state: errors.length === 0 ? "ok" : "fail",
    detail:
      errors.length === 0
        ? "No blocking conflicts. BlogPosting JSON-LD will emit with the resolved hero image."
        : `${errors.length} blocking conflict(s) — fix before publishing.`,
  });

  return out;
}

function stateClass(state: ChecklistItem["state"]): string {
  if (state === "ok") return "bg-[#E7F4EA] text-[#2E6A41]";
  if (state === "warn") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#F8E8EA] text-[#8A2F40]";
}

function stateLabel(state: ChecklistItem["state"]): string {
  if (state === "ok") return "Pass";
  if (state === "warn") return "Warn";
  return "Fail";
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // user can still manually select and copy
        }
      }}
      className="rounded-full bg-[#2F2624] px-3.5 py-1.5 text-xs font-medium text-[#F6F1EC] hover:opacity-90"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function ConflictItem({ conflict }: { conflict: Conflict }) {
  const palette =
    conflict.severity === "error"
      ? "border-[#8A2F40]/20 bg-[#FBEEF1] text-[#5E1C29]"
      : "border-[#8A6A2F]/20 bg-[#FBF5EA] text-[#5E4A1C]";
  return (
    <li className={`rounded-2xl border p-3 text-xs ${palette}`}>
      <p className="font-medium uppercase tracking-[0.12em]">
        {conflict.severity === "error" ? "Error" : "Warning"} · {conflict.code}
      </p>
      <p className="mt-1 text-sm text-[#1F1918]">{conflict.message}</p>
      {conflict.hint ? <p className="mt-1 opacity-85">{conflict.hint}</p> : null}
    </li>
  );
}

export function PublishControlPanel(props: Props) {
  const { preparation, validation, fallbackHeroImagePath, readinessVerdict, publishHref } = props;
  const post = preparation.insertionPreview;
  const heroEffective = post.heroImage || fallbackHeroImagePath;
  const checklist = buildChecklist(props);
  const errors = preparation.conflicts.filter((c) => c.severity === "error");
  const warnings = preparation.conflicts.filter((c) => c.severity === "warning");

  return (
    <article className="space-y-6">
      {/* 1. Summary header */}
      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-6 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[200px,1fr]">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
            {heroEffective ? (
              <Image
                src={heroEffective}
                alt={`${post.title} hero preview`}
                fill
                sizes="(min-width: 1024px) 200px, 100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-[#3B2F2F]/60">
                No hero image resolved.
              </p>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                  readinessVerdict === "ready"
                    ? "bg-[#E7F4EA] text-[#2E6A41]"
                    : readinessVerdict === "needs_review"
                      ? "bg-[#FBEEDE] text-[#7A4A12]"
                      : "bg-[#F8E8EA] text-[#8A2F40]",
                ].join(" ")}
                title={
                  readinessVerdict === "ready"
                    ? "All required checks passed."
                    : readinessVerdict === "needs_review"
                      ? "Not blocked, but improving this draft is recommended before publishing."
                      : "Do not publish yet — required image, schema, or content is missing."
                }
              >
                {readinessVerdict === "ready"
                  ? "Ready"
                  : readinessVerdict === "needs_review"
                    ? "Needs Review"
                    : "Do Not Publish Yet"}
              </span>
              <span className="inline-flex rounded-full bg-[#EEE4DB] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[#2E2323]">
                {preparation.draft.status.replace("_", " ")}
              </span>
              <span className="text-[11px] text-[#3B2F2F]/55">
                Prepared {formatDateTime(preparation.preparedAt)}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
              {post.title}
            </h2>
            <p className="mt-2 text-sm text-[#3B2F2F]/72">{post.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#3B2F2F]/65 sm:grid-cols-3">
              <div>
                <dt className="font-semibold uppercase tracking-[0.12em]">Slug</dt>
                <dd className="mt-1 font-mono text-[#1F1918]">{post.slug}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.12em]">Words</dt>
                <dd className="mt-1 text-[#1F1918] tabular-nums">{validation.wordCount}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.12em]">Sections</dt>
                <dd className="mt-1 text-[#1F1918] tabular-nums">{validation.sectionCount}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.12em]">Internal links</dt>
                <dd className="mt-1 text-[#1F1918] tabular-nums">{validation.internalLinkCount}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.12em]">Title length</dt>
                <dd className="mt-1 text-[#1F1918] tabular-nums">{post.title.length}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.12em]">Desc length</dt>
                <dd className="mt-1 text-[#1F1918] tabular-nums">{post.description.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* 2. Final publish checklist */}
      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Final publish checklist
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <li
              key={item.key}
              className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/82"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-[#1F1918]">{item.label}</p>
                <span
                  className={[
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    stateClass(item.state),
                  ].join(" ")}
                >
                  {stateLabel(item.state)}
                </span>
              </div>
              <p className="mt-1 opacity-90">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Publication output — clean form-style summary */}
      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Publication output
        </p>
        <p className="mt-1 text-xs text-[#3B2F2F]/65">
          The exact fields the published BlogPost literal will carry.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Title" value={post.title} />
          <Field label="Slug" value={post.slug} mono />
          <Field label="Category" value={post.category} />
          <Field label="Related product category" value={post.relatedProductCategory} />
          <Field label="Hero image" value={heroEffective ?? "— (will use brand OG fallback)"} mono />
          <Field label="Keywords" value={post.keywords.join(", ") || "—"} />
          <Field label="Description" value={post.description} wide />
          <Field label="CTA" value={`${post.cta.label} → ${post.cta.href}`} wide mono />
        </dl>
      </section>

      {/* Conflicts (if any) — kept visible, but compact */}
      {preparation.conflicts.length > 0 ? (
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Conflicts ({preparation.conflicts.length})
          </p>
          <ul className="mt-3 space-y-2">
            {errors.map((c, i) => (
              <ConflictItem key={`e-${i}`} conflict={c} />
            ))}
            {warnings.map((c, i) => (
              <ConflictItem key={`w-${i}`} conflict={c} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* 4. Publish — live from the admin. */}
      <PublishNowSection
        ready={preparation.ready}
        slug={preparation.insertionPreview.slug}
        publishHref={publishHref}
      />

      {/* 5. Advanced — collapsed JSON + diff */}
      <details className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Advanced: resolved BlogPost JSON
        </summary>
        <div className="mt-3 flex justify-end">
          <CopyButton text={JSON.stringify(preparation.insertionPreview, null, 2)} label="Copy JSON" />
        </div>
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-2xl bg-[#FBF7F3] p-4 text-xs font-mono leading-relaxed text-[#1F1918]">
          {JSON.stringify(preparation.insertionPreview, null, 2)}
        </pre>
      </details>

      <details className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Advanced: manual diff text (paste into lib/blog.ts)
        </summary>
        <div className="mt-3 flex justify-end">
          <CopyButton text={preparation.diffText} label="Copy diff" />
        </div>
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-2xl bg-[#FBF7F3] p-4 text-xs font-mono leading-relaxed text-[#1F1918]">
          {preparation.diffText}
        </pre>
      </details>
    </article>
  );
}

function PublishNowSection({
  ready,
  slug,
  publishHref,
}: {
  ready: boolean;
  slug: string;
  publishHref: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  const handlePublish = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch(publishHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; url: string }
        | { ok: false; error: string; conflicts?: { code: string; message: string }[] }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        const conflictLines =
          data && "conflicts" in data && Array.isArray(data.conflicts)
            ? ` — ${data.conflicts.map((c) => c.message).join(" · ")}`
            : "";
        setError(
          ((data && "error" in data && data.error) || "Failed to publish.") + conflictLines,
        );
        return;
      }
      setLiveUrl(data.url);
    });
  };

  if (liveUrl) {
    return (
      <section className="rounded-3xl border border-[#2E6A41]/25 bg-[#EAF5EE] p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#1E5A37]">
          Published
        </p>
        <p className="mt-2 text-sm text-[#1F1918]">
          The post is live and already in the blog index and sitemap — no deploy needed.
        </p>
        <a
          href={liveUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-full bg-[#2E6A41] px-5 py-2 text-sm font-medium text-[#F6F1EC] hover:opacity-90"
        >
          Open live post ↗
        </a>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[#2E6A41]/20 bg-[#EAF5EE] p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#1E5A37]">
        Publish
      </p>
      <p className="mt-2 text-sm text-[#1F1918]">
        Publishing is live from here — the post appears at{" "}
        <code className="font-mono">/blog/{slug}</code>, in the blog index, and in the sitemap
        immediately. The server re-runs every check above and refuses if anything blocking
        remains. Approval stays the human gate; this button just removes the deploy.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={!ready || isPending}
          title={ready ? "Publish this post live" : "Resolve the blocking conflicts above first"}
          className="rounded-full bg-[#2E6A41] px-6 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:opacity-45"
        >
          {isPending ? "Publishing…" : "Publish live"}
        </button>
        {!ready ? (
          <span className="text-[11px] text-[#8A2F40]">
            Blocked: resolve the error-severity conflicts above, then reload this page.
          </span>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-xs text-[#8A2F40]">{error}</p> : null}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`${wide ? "sm:col-span-2" : ""} rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3`}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3B2F2F]/55">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-sm ${mono ? "font-mono" : ""} text-[#1F1918]`}
      >
        {value}
      </dd>
    </div>
  );
}
