"use client";

// Tiny reusable "copy this block of text" button. Fires a fire-and-forget
// audit event so the admin can later see which client snippets were
// handed off and when.

import { useState } from "react";

type Props = {
  /** The text the button should copy. */
  text: string;
  label: string;
  copiedLabel?: string;
  /** Audit action name (must be in the /api/admin/audit/event whitelist). */
  auditAction?: string;
  /** Optional target metadata recorded on the audit row. */
  auditMetadata?: Record<string, unknown>;
  className?: string;
};

function fireAudit(auditAction: string, metadata: Record<string, unknown> | undefined): void {
  try {
    void fetch("/api/admin/audit/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: auditAction, metadata: metadata ?? null }),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

export function CopyTextButton({
  text,
  label,
  copiedLabel = "Copied ✓",
  auditAction,
  auditMetadata,
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  function onClick() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      window.prompt("Copy the text below:", text);
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (auditAction) fireAudit(auditAction, auditMetadata);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        window.prompt("Copy the text below:", text);
      });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ??
        "rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
