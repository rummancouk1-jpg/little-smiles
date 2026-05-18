// Engine component — presentational publish-preparation report. Operator-
// facing surface. Receives a fully-computed PublishPreparation from the
// wiring layer.
//
// Reviewer never sees this page (see commit G demotion in
// app/admin/contentops/[id]/page.tsx). Engineering artifacts — JSON
// preview and code patch — are collapsed inside disclosures so the page
// reads as an editorial check-list first.

"use client";

import { useState } from "react";

import { getConflictLabel } from "@/components/contentops/labels";
import { formatAbsolute } from "@/components/contentops/relative-time";
import type { Conflict, PublishPreparation } from "@/lib/contentops/publish-types";

type PublishReportProps = {
  preparation: PublishPreparation;
};

function ConflictItem({
  conflict,
  severityTone,
}: {
  conflict: Conflict;
  severityTone: "error" | "warning";
}) {
  const palette =
    severityTone === "error"
      ? {
          container: "border-[#8A2F40]/20 bg-[#FBEEF1]",
          label: "text-[#5E1C29]",
          hint: "text-[#5E1C29]/85",
        }
      : {
          container: "border-[#8A6A2F]/20 bg-[#FBF5EA]",
          label: "text-[#5E4A1C]",
          hint: "text-[#5E4A1C]/85",
        };
  return (
    <li className={`rounded-2xl border p-4 ${palette.container}`}>
      <p
        className={`flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] ${palette.label}`}
      >
        <span>{severityTone === "error" ? "Must fix" : "Heads up"}</span>
        <span className="rounded-full border border-current/40 px-2 py-0.5 font-mono text-[10px] tracking-normal opacity-70">
          {conflict.code}
        </span>
      </p>
      <p className="mt-2 text-sm text-[#1F1918]">{getConflictLabel(conflict.code)}</p>
      {conflict.hint ? (
        <p className={`mt-1 text-xs ${palette.hint}`}>{conflict.hint}</p>
      ) : null}
    </li>
  );
}

export function PublishReport({ preparation }: PublishReportProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preparation.diffText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fall-through; the user can still manually select and copy.
    }
  };

  const errorConflicts = preparation.conflicts.filter((c) => c.severity === "error");
  const warningConflicts = preparation.conflicts.filter((c) => c.severity === "warning");

  const bannerClasses = preparation.ready
    ? "border-[#2E6A41]/25 bg-[#EAF5EE]"
    : "border-[#8A2F40]/25 bg-[#FBEEF1]";
  const bannerLabelClasses = preparation.ready ? "text-[#1E5A37]" : "text-[#5E1C29]";

  return (
    <article className="space-y-6">
      <section
        className={`rounded-3xl border p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9 ${bannerClasses}`}
      >
        <p className={`text-xs font-medium uppercase tracking-[0.18em] ${bannerLabelClasses}`}>
          {preparation.ready ? "Cleared for publish" : "Needs attention"}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
          {preparation.draft.content.title}
        </h2>
        <p className="mt-2 text-xs text-[#3B2F2F]/65">
          Last checked {formatAbsolute(preparation.preparedAt)}
        </p>
      </section>

      <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Checks ({preparation.conflicts.length})
        </p>
        {preparation.conflicts.length === 0 ? (
          <p className="mt-2 text-sm text-[#1E5A37]">All checks passed. Nothing to flag.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {errorConflicts.map((conflict, idx) => (
              <ConflictItem key={`err-${idx}`} conflict={conflict} severityTone="error" />
            ))}
            {warningConflicts.map((conflict, idx) => (
              <ConflictItem key={`warn-${idx}`} conflict={conflict} severityTone="warning" />
            ))}
          </ul>
        )}
      </section>

      <details className="group rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55 group-open:text-[#1F1918]">
          Engineer details — article preview (JSON)
        </summary>
        {preparation.validation.schemaErrors.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#5E1C29]">
              Schema errors
            </p>
            <ul className="mt-2 space-y-1 text-xs text-[#5E1C29]">
              {preparation.validation.schemaErrors.map((err, idx) => (
                <li key={idx} className="font-mono">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <pre className="mt-3 max-h-[480px] overflow-auto rounded-2xl bg-[#FBF7F3] p-4 text-xs font-mono leading-relaxed text-[#1F1918]">
          {JSON.stringify(preparation.insertionPreview, null, 2)}
        </pre>
      </details>

      <details className="group rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55 group-open:text-[#1F1918]">
          Engineer details — code patch
        </summary>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#3B2F2F]/65">
            Paste before <span className="font-mono">]</span> in{" "}
            <span className="font-mono">lib/blog.ts</span>. Manual step until the hybrid
            publishing path lands.
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full bg-[#2F2624] px-4 py-2 text-xs font-medium text-[#F6F1EC] transition-opacity hover:opacity-90"
          >
            {copied ? "Copied" : "Copy patch"}
          </button>
        </div>
        <pre className="mt-3 max-h-[480px] overflow-auto rounded-2xl bg-[#FBF7F3] p-4 text-xs font-mono leading-relaxed text-[#1F1918]">
          {preparation.diffText}
        </pre>
      </details>
    </article>
  );
}
