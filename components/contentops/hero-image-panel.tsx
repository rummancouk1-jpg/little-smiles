"use client";

// Client-side hero-image picker. Renders the resolved current image, the
// list of allowed candidate paths (from the product catalog), Pinterest
// readiness hints per candidate, and an AI-generation placeholder that
// stays read-only unless CONTENTOPS_AI_IMAGE_PROVIDER is configured on
// the server. Selecting a candidate posts to /api/admin/contentops/.../hero-image.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  HeroImageCandidate,
  HeroImageMetrics,
  HeroImageSource,
  HeroImageWorkflow,
} from "@/lib/contentops/hero-image";
import type { LifestyleImageCandidate } from "@/lib/contentops/lifestyle-images";

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

function sourceLabel(source: HeroImageSource): { label: string; detail: string; tone: string } {
  if (source === "product_catalog") {
    return {
      label: "Product catalog",
      detail: "Reviewer-picked image from the product catalog.",
      tone: "bg-[#E7EEF7] text-[#1F3F66]",
    };
  }
  if (source === "lifestyle_library") {
    return {
      label: "Blog lifestyle library",
      detail: "Reviewer-picked image from the curated lifestyle library.",
      tone: "bg-[#E7F4EA] text-[#2E6A41]",
    };
  }
  if (source === "manual_approved") {
    return {
      label: "Manual approved path",
      detail: "Reviewer-entered image path under /public — admin-approved.",
      tone: "bg-[#EEE4DB] text-[#2E2323]",
    };
  }
  if (source === "auto_resolved_fallback") {
    return {
      label: "Auto-resolved fallback",
      detail: "No reviewer override yet — using the anchor product image for this category.",
      tone: "bg-[#FBEEDE] text-[#7A4A12]",
    };
  }
  return {
    label: "No image yet",
    detail: "No reviewer pick and no anchor product — pick a candidate below.",
    tone: "bg-[#F8E8EA] text-[#8A2F40]",
  };
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
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Hero image
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={[
                "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
                sourceLabel(workflow.effectiveSource).tone,
              ].join(" ")}
              title={sourceLabel(workflow.effectiveSource).detail}
            >
              Source: {sourceLabel(workflow.effectiveSource).label}
            </span>
          </div>
          <p className="mt-2 text-xs text-[#3B2F2F]/65">
            {sourceLabel(workflow.effectiveSource).detail} The selected image propagates to the
            draft review, prepare-publish JSON, the live blog page, BlogPosting JSON-LD, and the
            OpenGraph / Twitter card.
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
            Product image candidates ({workflow.suggestions.length})
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

      <LifestyleCandidates
        bundle={workflow.lifestyle}
        currentPath={workflow.effectivePath}
        pending={isPending}
        pendingTarget={selectionTarget}
        onSelect={(path) => submit(path)}
      />

      <ManualPathInput pending={isPending && selectionTarget !== null} onSubmit={submit} />

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
        <p className="mt-3 rounded-xl border border-[#7A4A12]/20 bg-[#FBF5EA] px-3 py-2 text-[11px] leading-relaxed text-[#5E4A1C]">
          <span className="font-semibold uppercase tracking-wide">Safety:</span> AI image generation
          is disabled unless explicitly configured. An admin must approve any generated or uploaded
          image before publishing.
        </p>
      </div>
    </section>
  );
}

function ManualPathInput({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (heroImagePath: string) => void;
}) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    setLocalError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setLocalError("Enter a path that starts with '/' (e.g. /uploads/blog/hero.jpg).");
      return;
    }
    if (!trimmed.startsWith("/")) {
      setLocalError("Path must start with '/'. External URLs are not accepted — drop the file into public/ first.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="mt-6 rounded-2xl border border-[#3B2F2F]/10 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
        Manual image path (admin-approved)
      </p>
      <p className="mt-1 text-xs text-[#3B2F2F]/65">
        Reach for this when the catalog and lifestyle library don&apos;t fit and you have a curated
        image ready to publish.
      </p>
      <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-[#3B2F2F]/72">
        <li className="flex items-start gap-2">
          <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B2F2F]/55" />
          <span>
            Only paths under <code className="font-mono">/public</code> are accepted (must start
            with <code className="font-mono">/</code>).
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B2F2F]/55" />
          <span>
            External URLs (<code className="font-mono">http://</code>,{" "}
            <code className="font-mono">https://</code>) are rejected by the server.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B2F2F]/55" />
          <span>
            The admin (you) must visually approve the image — nothing here generates or fetches
            images on its own.
          </span>
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="/uploads/blog/your-image.jpg"
          spellCheck={false}
          inputMode="url"
          className="w-full min-w-0 flex-1 rounded-full border border-[#3B2F2F]/14 bg-[#FDF8F4] px-3.5 py-2 font-mono text-xs text-[#1F1918] placeholder:text-[#3B2F2F]/35 focus:outline-none focus:ring-2 focus:ring-[#7A4A12]/30 sm:w-auto"
          aria-label="Approved hero image path under public/"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-full bg-[#2F2624] px-3.5 py-1.5 text-xs font-medium text-[#F6F1EC] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Use this path"}
        </button>
      </div>
      {localError ? (
        <p className="mt-2 text-[11px] text-[#8A2F40]">{localError}</p>
      ) : null}
    </div>
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

function lifestyleVerdictTone(verdict: "vertical_ideal" | "square" | "horizontal_or_small" | "unreadable"): string {
  if (verdict === "vertical_ideal") return "bg-[#E7F4EA] text-[#2E6A41]";
  if (verdict === "square") return "bg-[#E7EEF7] text-[#1F3F66]";
  if (verdict === "horizontal_or_small") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#F8E8EA] text-[#8A2F40]";
}

function lifestyleVerdictLabel(verdict: "vertical_ideal" | "square" | "horizontal_or_small" | "unreadable"): string {
  if (verdict === "vertical_ideal") return "Vertical (ideal)";
  if (verdict === "square") return "Square";
  if (verdict === "horizontal_or_small") return "Horizontal / small";
  return "Unreadable";
}

function LifestyleCard({
  candidate,
  isCurrent,
  pending,
  onSelect,
}: {
  candidate: LifestyleImageCandidate;
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
          src={candidate.filePath}
          alt={`Lifestyle hero candidate: ${candidate.title}`}
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          unoptimized
        />
      </div>
      <p className="mt-2 font-medium text-[#1F1918]">{candidate.title}</p>
      <p className="mt-0.5 text-[#3B2F2F]/65">Use case: {candidate.useCase}</p>
      <p className="mt-0.5 font-mono text-[10px] text-[#3B2F2F]/55 break-all">{candidate.filePath}</p>
      {candidate.tags.length > 0 ? (
        <p className="mt-1 flex flex-wrap gap-1">
          {candidate.tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full bg-[#EEE4DB] px-2 py-0.5 text-[10px] font-medium text-[#2E2323]"
            >
              {tag}
            </span>
          ))}
        </p>
      ) : null}
      <p className="mt-2">
        <span
          className={[
            "mr-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            lifestyleVerdictTone(candidate.metrics.verdict),
          ].join(" ")}
        >
          {lifestyleVerdictLabel(candidate.metrics.verdict)}
        </span>
        {candidate.matchScore > 0 ? (
          <span className="inline-flex rounded-full bg-[#E7EEF7] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#1F3F66]">
            Match {candidate.matchScore}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-[#EEE4DB] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E2323]">
            Generic fallback
          </span>
        )}
      </p>
      <p className="mt-1 text-[10px] text-[#3B2F2F]/65">{candidate.matchReason}</p>
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
          {isCurrent ? "Selected" : pending ? "Saving…" : "Use this image"}
        </button>
      </div>
    </li>
  );
}

function LifestyleCandidates({
  bundle,
  currentPath,
  pending,
  pendingTarget,
  onSelect,
}: {
  bundle: HeroImageWorkflow["lifestyle"];
  currentPath: string | null;
  pending: boolean;
  pendingTarget: string | null;
  onSelect: (path: string) => void;
}) {
  const hasAny = bundle.matched.length + bundle.fallback.length > 0;

  return (
    <section className="mt-6 rounded-2xl border border-[#3B2F2F]/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
            Blog lifestyle library
          </p>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Non-product hero candidates. Curated manually — no scraping, no AI generation. Images
            live under <code className="font-mono">public{bundle.rootDir}</code>.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-[#EEE4DB] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#2E2323]">
          {bundle.manifestSize === 0
            ? "Library empty"
            : `${bundle.matched.length + bundle.fallback.length} / ${bundle.manifestSize} available`}
        </span>
      </div>

      {bundle.manifestSize === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-[#3B2F2F]/14 bg-[#FBF7F3] p-3 text-[11px] leading-relaxed text-[#3B2F2F]/72">
          <p className="font-medium text-[#1F1918]">No approved lifestyle images yet.</p>
          <p className="mt-1">
            Add curated images to <code className="font-mono">/public{bundle.rootDir}</code> and
            register them in{" "}
            <code className="font-mono">lib/contentops/lifestyle-images.ts</code> with a title,
            tags, and a one-sentence use case. The reviewer will see them here on the next refresh.
          </p>
        </div>
      ) : !hasAny ? (
        <p className="mt-3 rounded-xl border border-[#8A6A2F]/20 bg-[#FBF5EA] p-3 text-[11px] leading-relaxed text-[#5E4A1C]">
          The lifestyle manifest has {bundle.manifestSize} entr{bundle.manifestSize === 1 ? "y" : "ies"}, but none resolve to a real file on disk. Missing:{" "}
          {bundle.missingFiles.slice(0, 5).join(", ")}
          {bundle.missingFiles.length > 5 ? "…" : ""}
        </p>
      ) : (
        <>
          {bundle.matched.length > 0 ? (
            <>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-[#3B2F2F]/55">
                Matched to this draft ({bundle.matched.length})
              </p>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bundle.matched.map((candidate) => (
                  <LifestyleCard
                    key={candidate.filePath}
                    candidate={candidate}
                    isCurrent={currentPath === candidate.filePath}
                    pending={pending && pendingTarget === candidate.filePath}
                    onSelect={() => onSelect(candidate.filePath)}
                  />
                ))}
              </ul>
            </>
          ) : null}

          {bundle.fallback.length > 0 ? (
            <>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-[#3B2F2F]/55">
                Generic fallbacks ({bundle.fallback.length})
              </p>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bundle.fallback.map((candidate) => (
                  <LifestyleCard
                    key={candidate.filePath}
                    candidate={candidate}
                    isCurrent={currentPath === candidate.filePath}
                    pending={pending && pendingTarget === candidate.filePath}
                    onSelect={() => onSelect(candidate.filePath)}
                  />
                ))}
              </ul>
            </>
          ) : null}

          {bundle.missingFiles.length > 0 ? (
            <p className="mt-3 text-[10px] text-[#3B2F2F]/55">
              Note: {bundle.missingFiles.length} manifest entr
              {bundle.missingFiles.length === 1 ? "y is" : "ies are"} pointing at missing files and
              have been hidden.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
