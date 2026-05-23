"use client";

// Client-side copy buttons for the Improve Draft page. Lets a non-technical
// reviewer hand a fully-formed brief to a writer or to an external LLM
// without re-typing the deterministic data we've already computed.
//
// No AI calls run from here — these are pure clipboard writes. Each copy
// fires a fire-and-forget POST to /api/admin/audit/event so the audit log
// records what was handed off and when.

import { useState } from "react";

import type {
  DraftImprovementReport,
  SuggestedFaq,
  SuggestedInternalLink,
  SuggestedSection,
} from "@/lib/contentops/improvement";

type Props = {
  report: DraftImprovementReport;
  draftId: string;
  draftTitle: string;
  draftSlug: string;
  /** Stable identifiers used to log the copy action with target context. */
  draftRelatedCategory: string;
};

const BRAND_TONE_INSTRUCTION =
  "Tone: warm, parent-friendly, calm, evidence-based. Avoid spammy superlatives, AI-cliché phrases, and aggressive sales language. Plain Pakistani-English where possible.";

function formatSection(s: SuggestedSection, idx: number): string {
  return `  ${idx + 1}. ${s.heading}\n     ${s.rationale}`;
}

function formatFaq(q: SuggestedFaq, idx: number): string {
  return `  ${idx + 1}. ${q.question}\n     Why: ${q.rationale}`;
}

function formatLink(l: SuggestedInternalLink, idx: number): string {
  const target =
    l.toKind === "category"
      ? `/shop?category=${encodeURIComponent(l.toSlugOrCategory)}`
      : l.toKind === "product"
        ? `/shop/${l.toSlugOrCategory}`
        : `/blog/${l.toSlugOrCategory}`;
  return `  ${idx + 1}. ${l.toKind.toUpperCase()} → ${l.toTitle}\n     Anchor text: "${l.suggestedAnchor}"\n     URL: ${target}\n     Why: ${l.reason}`;
}

function buildFullBrief(p: Props): string {
  const { report, draftTitle, draftSlug, draftRelatedCategory } = p;
  const { validation, recommendation, weaknesses } = report;

  const weaknessLines =
    weaknesses.length > 0
      ? weaknesses.map((w, i) => `  ${i + 1}. ${w.label} — ${w.detail}`).join("\n")
      : "  (none — draft already passes deterministic checks)";

  const sectionLines =
    recommendation.suggestedSections.length > 0
      ? recommendation.suggestedSections.map(formatSection).join("\n")
      : "  (current section count already meets the target band)";

  const faqLines =
    recommendation.suggestedFaqs.length > 0
      ? recommendation.suggestedFaqs.map(formatFaq).join("\n")
      : "  (post already has an FAQ-style heading or doesn't need one)";

  const linkLines =
    recommendation.suggestedInternalLinks.length > 0
      ? recommendation.suggestedInternalLinks.map(formatLink).join("\n")
      : "  (no high-confidence internal-link suggestions for this draft)";

  const ctaLine = recommendation.suggestedProductCta
    ? `  Product: ${recommendation.suggestedProductCta.name} (/shop/${recommendation.suggestedProductCta.slug})\n  Reason: ${recommendation.suggestedProductCta.reason}\n  Final CTA href: /shop?category=${encodeURIComponent(draftRelatedCategory)}`
    : `  (no in-stock anchor product in category "${draftRelatedCategory}" — point CTA at /shop?category=${encodeURIComponent(draftRelatedCategory)} once stock is restored)`;

  return [
    `Little Smiles — Blog improvement brief`,
    ``,
    `Title:  ${draftTitle}`,
    `Slug:   ${draftSlug}`,
    `Category: ${draftRelatedCategory}`,
    ``,
    `Current draft state:`,
    `  ${validation.wordCount} words · ${validation.sectionCount} sections · ${validation.internalLinkCount} internal link(s)`,
    ``,
    `Current weaknesses:`,
    weaknessLines,
    ``,
    `Target word band: ${recommendation.targets.wordCountMin}-${recommendation.targets.wordCountMax} words across ${recommendation.targets.sectionCountMin}-${recommendation.targets.sectionCountMax} sections.`,
    `Target FAQs: ${recommendation.targets.faqMin}-${recommendation.targets.faqMax} entries.`,
    `Target metadata: title ${recommendation.targets.titleMin}-${recommendation.targets.titleMax} chars · description ${recommendation.targets.descriptionMin}-${recommendation.targets.descriptionMax} chars · ≥${recommendation.targets.keywordsMin} keywords.`,
    ``,
    `Suggested new sections:`,
    sectionLines,
    ``,
    `Suggested FAQ questions:`,
    faqLines,
    ``,
    `Suggested internal links:`,
    linkLines,
    ``,
    `Recommended product CTA:`,
    ctaLine,
    ``,
    BRAND_TONE_INSTRUCTION,
  ].join("\n");
}

function buildFaqPlan(p: Props): string {
  const { report, draftTitle, draftSlug } = p;
  const lines =
    report.recommendation.suggestedFaqs.length > 0
      ? report.recommendation.suggestedFaqs.map(formatFaq).join("\n")
      : "  (post already has an FAQ-style heading or doesn't need one)";
  return [
    `Little Smiles — FAQ plan`,
    `Post: ${draftTitle} (${draftSlug})`,
    ``,
    `Add ${report.recommendation.targets.faqMin}-${report.recommendation.targets.faqMax} short FAQ entries.`,
    `Each answer: 2-3 sentences, plain language, no marketing fluff.`,
    ``,
    `Suggested questions:`,
    lines,
    ``,
    BRAND_TONE_INSTRUCTION,
  ].join("\n");
}

function buildLinkInstructions(p: Props): string {
  const { report, draftTitle, draftSlug } = p;
  const lines =
    report.recommendation.suggestedInternalLinks.length > 0
      ? report.recommendation.suggestedInternalLinks.map(formatLink).join("\n")
      : "  (no high-confidence internal-link suggestions for this draft)";
  return [
    `Little Smiles — Internal link instructions`,
    `Post: ${draftTitle} (${draftSlug})`,
    ``,
    `Place each link inline inside a relevant sentence. Don't dump them at the end of the article.`,
    `Use the suggested anchor text where it reads naturally; rewrite the sentence around it if needed.`,
    ``,
    lines,
    ``,
    BRAND_TONE_INSTRUCTION,
  ].join("\n");
}

function buildCtaInstructions(p: Props): string {
  const { report, draftTitle, draftSlug, draftRelatedCategory } = p;
  const cta = report.recommendation.suggestedProductCta;
  const body = cta
    ? [
        `Anchor product: ${cta.name} (/shop/${cta.slug})`,
        `Reason: ${cta.reason}`,
        ``,
        `Final CTA href (use this verbatim): /shop?category=${encodeURIComponent(draftRelatedCategory)}`,
        `CTA copy idea: "Browse our ${draftRelatedCategory.toLowerCase()} collection →" (keep it warm, not pushy).`,
      ].join("\n")
    : `No in-stock anchor product in category "${draftRelatedCategory}". Once stock is restored, point the CTA at /shop?category=${encodeURIComponent(draftRelatedCategory)}.`;
  return [
    `Little Smiles — Recommended CTA`,
    `Post: ${draftTitle} (${draftSlug})`,
    ``,
    body,
    ``,
    BRAND_TONE_INSTRUCTION,
  ].join("\n");
}

type CopyKey = "full_brief" | "faq_plan" | "link_instructions" | "cta";

function logCopy(action: CopyKey, draftId: string): void {
  // Fire-and-forget. We deliberately don't surface failures: the copy
  // already succeeded; the audit log entry is best-effort observability.
  try {
    void fetch("/api/admin/audit/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "improve_brief_copied",
        targetType: "draft",
        targetId: draftId,
        metadata: { variant: action },
      }),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

export function DraftBriefCopyButtons(props: Props) {
  const [copied, setCopied] = useState<CopyKey | null>(null);

  function doCopy(key: CopyKey, text: string): void {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      window.prompt("Copy the brief below:", text);
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        logCopy(key, props.draftId);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {
        window.prompt("Copy the brief below:", text);
      });
  }

  const buttons: { key: CopyKey; label: string; build: () => string }[] = [
    { key: "full_brief", label: "Copy full improvement brief", build: () => buildFullBrief(props) },
    { key: "faq_plan", label: "Copy FAQ plan", build: () => buildFaqPlan(props) },
    {
      key: "link_instructions",
      label: "Copy internal-link instructions",
      build: () => buildLinkInstructions(props),
    },
    { key: "cta", label: "Copy recommended CTA", build: () => buildCtaInstructions(props) },
  ];

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-[#1F1918]">Copy-to-clipboard brief</h3>
      <p className="mt-1 text-xs text-[#3B2F2F]/65">
        Hand off to a writer or paste into an external LLM. No AI runs from here — these buttons just format the
        deterministic data above into plain-text briefs.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => doCopy(b.key, b.build())}
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
          >
            {copied === b.key ? "Copied ✓" : b.label}
          </button>
        ))}
      </div>
    </article>
  );
}
