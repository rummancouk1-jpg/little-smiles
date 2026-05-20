// Operator-facing revisions card. Hides itself entirely when neither a
// previous-version snapshot nor a meaningfully-different AI snapshot
// exists, so the article-review page stays calm for drafts that have
// never been edited.
//
// Each available snapshot shows as a <details> disclosure with a
// summary headline + collapsed preview of title/description/structure +
// a single Restore button. The brief explicitly asked for "lightweight"
// — no diff viewer, no side-by-side, no multi-snapshot history.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatRelativeTime } from "@/components/contentops/relative-time";
import type { BlogPost } from "@/lib/contentops/blog-schema";

type RevisionsCardProps = {
  draftId: string;
  currentContent: BlogPost;
  previousContent: BlogPost | null;
  aiContent: BlogPost | null;
  lastEditedAt: string | null;
  manuallyEdited: boolean;
};

type Source = "previous" | "ai_generated";

function deepEqual(a: BlogPost, b: BlogPost): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function SnapshotPreview({ snapshot }: { snapshot: BlogPost }) {
  return (
    <dl className="mt-3 space-y-3 text-xs text-[#3B2F2F]/72">
      <div>
        <dt className="font-semibold uppercase tracking-[0.12em]">Title</dt>
        <dd className="mt-1 text-[#1F1918]">{snapshot.title}</dd>
      </div>
      <div>
        <dt className="font-semibold uppercase tracking-[0.12em]">Description</dt>
        <dd className="mt-1 text-[#1F1918]">{snapshot.description}</dd>
      </div>
      <div>
        <dt className="font-semibold uppercase tracking-[0.12em]">Structure</dt>
        <dd className="mt-1 text-[#1F1918]">
          {snapshot.sections.length}{" "}
          {snapshot.sections.length === 1 ? "section" : "sections"} · CTA reads
          &ldquo;{snapshot.cta.label}&rdquo;
        </dd>
      </div>
    </dl>
  );
}

export function RevisionsCard({
  draftId,
  currentContent,
  previousContent,
  aiContent,
  lastEditedAt,
  manuallyEdited,
}: RevisionsCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Only surface the AI snapshot when it's actually different from the
  // current content. If the operator has restored to AI (or never
  // edited), there's nothing to restore back to.
  const aiAvailable =
    aiContent !== null && !deepEqual(aiContent, currentContent);

  if (!previousContent && !aiAvailable) {
    return null;
  }

  const restore = (source: Source) => {
    setError(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(
          `/api/admin/contentops/drafts/${draftId}/restore`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source }),
          },
        );
      } catch {
        setError("Network problem. Try again.");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) || "Failed to restore.",
        );
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
        Revisions
      </p>
      <p className="mt-1 text-sm text-[#3B2F2F]/72">
        Single-step undo is always available. Restoring the original AI draft
        replaces the current content; you can still undo that with the previous
        snapshot below.
      </p>

      <div className="mt-5 space-y-3">
        {previousContent ? (
          <details className="group rounded-2xl border border-[#3B2F2F]/8 bg-[#FBF7F3]/80 px-4 py-3">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55 group-open:text-[#1F1918]">
              <span>Previous version</span>
              {lastEditedAt ? (
                <span className="text-[#3B2F2F]/55 normal-case tracking-normal">
                  edited {formatRelativeTime(lastEditedAt)}
                </span>
              ) : null}
            </summary>
            <SnapshotPreview snapshot={previousContent} />
            <button
              type="button"
              onClick={() => restore("previous")}
              disabled={isPending}
              className="mt-4 rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Restoring…" : "Restore this version"}
            </button>
          </details>
        ) : null}

        {aiAvailable && aiContent ? (
          <details className="group rounded-2xl border border-[#3B2F2F]/8 bg-[#FBF7F3]/80 px-4 py-3">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55 group-open:text-[#1F1918]">
              <span>Original AI draft</span>
              {manuallyEdited ? (
                <span className="text-[#3B2F2F]/55 normal-case tracking-normal">
                  before your edits
                </span>
              ) : null}
            </summary>
            <SnapshotPreview snapshot={aiContent} />
            <button
              type="button"
              onClick={() => restore("ai_generated")}
              disabled={isPending}
              className="mt-4 rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Restoring…" : "Restore AI draft"}
            </button>
          </details>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-[#8A2F40]">{error}</p> : null}
    </section>
  );
}
