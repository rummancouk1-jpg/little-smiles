"use client";

// Client-side hero-image picker. Renders the resolved current image, the
// list of allowed candidate paths (from the product catalog), Pinterest
// readiness hints per candidate, and an AI-generation placeholder that
// stays read-only unless CONTENTOPS_AI_IMAGE_PROVIDER is configured on
// the server. Selecting a candidate posts to /api/admin/contentops/.../hero-image.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { HeroImageCandidate, HeroImageMetrics, HeroImageWorkflow } from "@/lib/contentops/hero-image";

type Props = {
  draftId: string;
  workflow: HeroImageWorkflow;
};

function verdictTone(verdict: HeroImageMetrics["verdict"]): string {
  if (verdict === "vertical_ideal") return "bg-[#E7F4EA] text-[#2E6A41]";
  if (verdict === "square") return "bg-[#E7EEF7] text-[#1F3F66]";
  if (verdict === "horizontal_or_small") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#F8E8EA] text-[#8A2F40]";
}

function verdictLabel(verdict: HeroImageMetrics["verdict"]): string {
  if (verdict === "vertical_ideal") return "Vertical (ideal)";
  if (verdict === "square") return "Square";
  if (verdict === "horizontal_or_small") return "Horizontal / small";
  if (verdict === "missing") return "File missing";
  return "Unreadable";
}

export function HeroImagePanel({ draftId, workflow }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectionTarget, setSelectionTarget] = useState<string | null>(null);

  const submit = (heroImagePath: string | null) => {
    setError(null);
    setSelectionTarget(heroImagePath);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/contentops/drafts/${draftId}/hero-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ heroImagePath }),
        });
        const data = (await response.json().catch(() => null)) as
          | { ok: true; draft: unknown }
          | { ok: false; error: string }
          | null;
        if (!response.ok || !data || data.ok !== true) {
          setError((data && "error" in data && data.error) || "Failed to update hero image.");
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error while updating hero image.");
      } finally {
        setSelectionTarget(null);
      }
    });
  };

  const ai = workflow.aiProvider;

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Hero image
          </p>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Current image is{" "}
            {workflow.isOverride ? (
              <span className="font-medium text-[#1F1918]">reviewer-selected</span>
            ) : (
              <span className="font-medium text-[#1F1918]">auto-resolved from catalog</span>
            )}
            . Selecting a candidate stores it on the draft and is consumed by JSON-LD and the on-page hero.
          </p>
        </div>
        {workflow.isOverride ? (
          <button
            type="button"
            onClick={() => submit(null)}
            disabled={isPending}
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:opacity-50"
          >
            {isPending && selectionTarget === null ? "Clearing…" : "Reset to auto-resolved"}
          </button>
        ) : null}
      </div>

      {workflow.effectivePath ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-[220px,1fr]">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
            <Image
              src={workflow.effectivePath}
              alt="Resolved hero image preview"
              fill
              sizes="(min-width: 640px) 220px, 100vw"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="text-xs text-[#3B2F2F]/72">
            <p className="font-mono text-[#1F1918]">{workflow.effectivePath}</p>
            {workflow.effectiveMetrics ? (
              <p className="mt-2">
                <span
                  className={[
                    "mr-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    verdictTone(workflow.effectiveMetrics.verdict),
                  ].join(" ")}
                >
                  {verdictLabel(workflow.effectiveMetrics.verdict)}
                </span>
                {workflow.effectiveMetrics.note}
              </p>
            ) : null}
            {!workflow.isOverride && workflow.autoResolvedPath ? (
              <p className="mt-3 text-[#3B2F2F]/60">
                Auto-resolved via <code className="font-mono">getBlogAnchorProduct()</code> from{" "}
                <code className="font-mono">relatedProductCategory</code>.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-[#FBEEDE] bg-[#FBF5EA] p-4 text-sm text-[#5E4A1C]">
          No hero image resolved — neither the catalog category nor the reviewer override yielded a path.
        </p>
      )}

      {error ? (
        <p className="mt-3 rounded-2xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-3 text-xs text-[#5E1C29]">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Select image ({workflow.suggestions.length} catalog candidates)
          </p>
          <p className="text-[11px] text-[#3B2F2F]/55">
            Pinterest ideal: 2:3 vertical, ≥ 1000px wide
          </p>
        </div>
        {workflow.suggestions.length === 0 ? (
          <p className="mt-3 text-xs text-[#3B2F2F]/72">
            No catalog candidates available. Add at least one product image to enable suggestions.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workflow.suggestions.map((candidate) => (
              <CandidateCard
                key={`${candidate.productSlug}-${candidate.metrics.filePath}`}
                candidate={candidate}
                isCurrent={workflow.effectivePath === candidate.metrics.filePath}
                pending={isPending && selectionTarget === candidate.metrics.filePath}
                onSelect={() => submit(candidate.metrics.filePath)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-[#3B2F2F]/14 bg-[#FBF7F3] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              AI image generation
            </p>
            <p className="mt-1 text-sm text-[#1F1918]">
              {ai.configured ? (
                <>Provider configured: <span className="font-mono">{ai.provider}</span></>
              ) : (
                <>Not configured.</>
              )}
            </p>
            <p className="mt-1 text-xs text-[#3B2F2F]/65">
              {ai.configured
                ? "Generation UI will appear here once the provider is wired. No external calls happen automatically."
                : ai.reason}
            </p>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#3B2F2F]/45"
            title="Disabled — no provider call wired in production."
          >
            Generate with AI (off)
          </button>
        </div>
      </div>
    </section>
  );
}

function CandidateCard({
  candidate,
  isCurrent,
  pending,
  onSelect,
}: {
  candidate: HeroImageCandidate;
  isCurrent: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      className={[
        "rounded-2xl border bg-white p-3 text-xs",
        isCurrent ? "border-[#2E6A41]/40 bg-[#EAF5EE]" : "border-[#3B2F2F]/10",
      ].join(" ")}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
        <Image
          src={candidate.metrics.filePath}
          alt={`Candidate hero image: ${candidate.productName}`}
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          unoptimized
        />
      </div>
      <p className="mt-2 font-medium text-[#1F1918]">{candidate.productName}</p>
      <p className="mt-0.5 text-[#3B2F2F]/65">{candidate.category}</p>
      <p className="mt-0.5 font-mono text-[10px] text-[#3B2F2F]/55 break-all">{candidate.metrics.filePath}</p>
      <p className="mt-2">
        <span
          className={[
            "mr-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            verdictTone(candidate.metrics.verdict),
          ].join(" ")}
        >
          {verdictLabel(candidate.metrics.verdict)}
        </span>
      </p>
      <p className="mt-1 text-[10px] text-[#3B2F2F]/65">{candidate.reason}</p>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-[#3B2F2F]/55">{candidate.metrics.note}</p>
        <button
          type="button"
          onClick={onSelect}
          disabled={pending || isCurrent}
          className={[
            "rounded-full px-3 py-1 text-[11px] font-medium",
            isCurrent
              ? "border border-[#2E6A41]/30 bg-white text-[#2E6A41]"
              : "bg-[#2F2624] text-[#F6F1EC] hover:opacity-90",
            pending || isCurrent ? "opacity-70" : "",
          ].join(" ")}
        >
          {isCurrent ? "Selected" : pending ? "Saving…" : "Use this"}
        </button>
      </div>
    </li>
  );
}
