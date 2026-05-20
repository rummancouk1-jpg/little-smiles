// Operator-facing media uploader for a single slot (hero or thumbnail).
//
// Two states:
//   - empty: shows a drag/drop zone + click-to-upload. Operator picks a
//     file, fills in alt text (required) and optional caption, then
//     submits. The component uploads the blob and immediately attaches
//     it to the slot. router.refresh() reloads the page so the parent
//     re-renders with the new content.
//   - attached: shows the current image preview, alt text, caption, and
//     Replace / Remove actions. Replace goes back to the empty flow with
//     the previous file cleared.
//
// Calm editorial feel: compact card, no heavy emphasis, no progress
// chrome beyond a clear pending state on the submit button. No drag
// feedback animations beyond a subtle border highlight. Image-source
// agnostic — works for curated stock, photography, or AI output equally.

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ImageGenerateButton } from "@/components/contentops/image-generate-button";
import { SafeImage } from "@/components/contentops/safe-image";
import type { BlogImage, BlogImageSlot } from "@/lib/contentops/blog-schema";

type MediaUploaderProps = {
  label: string;
  helperText: string;
  current: BlogImage | null;
  uploadHref: string;
  slotHref: string;
  disabled?: boolean;
  /** Phase 5: when both fields are set, surface the "Generate with AI" action. */
  draftId?: string;
  slot?: BlogImageSlot;
  /** Whether a provider is configured server-side. Drives the button state. */
  providerConfigured?: boolean;
  /** Operator-friendly label for the generate action ("Generate Hero image"). */
  generateLabel?: string;
};

type EmptyState =
  | { mode: "idle" }
  | { mode: "selected"; file: File; previewUrl: string };

const ACCEPT_TYPES = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT_TYPE_SET = new Set(["image/jpeg", "image/png", "image/webp"]);

export function MediaUploader({
  label,
  helperText,
  current,
  uploadHref,
  slotHref,
  disabled = false,
  draftId,
  slot,
  providerConfigured = false,
  generateLabel,
}: MediaUploaderProps) {
  const canGenerate = Boolean(draftId && slot && !disabled);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [emptyState, setEmptyState] = useState<EmptyState>({ mode: "idle" });
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // Edit-details mode (Commit X): operator refines alt text and/or
  // caption on an already-attached image without re-uploading the blob.
  const [editingDetails, setEditingDetails] = useState(false);
  const [editAltText, setEditAltText] = useState(current?.altText ?? "");
  const [editCaption, setEditCaption] = useState(current?.caption ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Object-URL hygiene: revoke the preview URL whenever the selection
  // changes or the component unmounts, so the browser doesn't hold the
  // blob in memory indefinitely.
  useEffect(() => {
    if (emptyState.mode !== "selected") return;
    const url = emptyState.previewUrl;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [emptyState]);

  const resetSelection = () => {
    setEmptyState({ mode: "idle" });
    setAltText("");
    setCaption("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = (file: File) => {
    if (!ACCEPT_TYPE_SET.has(file.type)) {
      setError("Unsupported format. Use JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File too large. Maximum 8 MB.");
      return;
    }
    setError(null);
    setEmptyState({
      mode: "selected",
      file,
      previewUrl: URL.createObjectURL(file),
    });
  };

  const onPickClick = () => {
    if (disabled || isPending) return;
    fileInputRef.current?.click();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || isPending) return;
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const submitUpload = () => {
    if (emptyState.mode !== "selected") return;
    if (altText.trim().length === 0) {
      setError("Alt text is required for accessibility.");
      return;
    }
    setError(null);
    const file = emptyState.file;
    const trimmedAlt = altText.trim();
    const trimmedCaption = caption.trim();

    startTransition(async () => {
      // Step 1: upload the blob.
      const form = new FormData();
      form.append("file", file);
      form.append("altText", trimmedAlt);

      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(uploadHref, { method: "POST", body: form });
      } catch {
        setError("Upload failed (network).");
        return;
      }

      const uploadData = (await uploadResponse.json().catch(() => null)) as
        | { ok: true; image: BlogImage }
        | { ok: false; error: string }
        | null;
      if (!uploadResponse.ok || !uploadData || uploadData.ok !== true) {
        setError(
          (uploadData && "error" in uploadData && uploadData.error) ||
            "Upload failed.",
        );
        return;
      }

      // The caption isn't part of the upload endpoint; merge it in
      // before attaching so the attached image carries both fields.
      const imageWithCaption: BlogImage = trimmedCaption.length > 0
        ? { ...uploadData.image, caption: trimmedCaption }
        : uploadData.image;

      // Step 2: attach to the slot.
      let attachResponse: Response;
      try {
        attachResponse = await fetch(slotHref, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageWithCaption }),
        });
      } catch {
        setError(
          "Upload succeeded but attach failed (network). Refresh and retry.",
        );
        return;
      }

      const attachData = (await attachResponse.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!attachResponse.ok || !attachData || attachData.ok !== true) {
        setError(
          (attachData && "error" in attachData && attachData.error) ||
            "Attach failed.",
        );
        return;
      }

      resetSelection();
      router.refresh();
    });
  };

  const submitMetadataEdit = () => {
    setError(null);
    const trimmedAlt = editAltText.trim();
    if (trimmedAlt.length === 0) {
      setError("Alt text cannot be empty.");
      return;
    }
    if (trimmedAlt.length > 500) {
      setError("Alt text too long (max 500 characters).");
      return;
    }
    const trimmedCaption = editCaption.trim();
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(slotHref, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            altText: trimmedAlt,
            caption: trimmedCaption.length > 0 ? trimmedCaption : null,
          }),
        });
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
          (data && "error" in data && data.error) ||
            "Failed to update image details.",
        );
        return;
      }
      setEditingDetails(false);
      router.refresh();
    });
  };

  const submitRemove = () => {
    setError(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(slotHref, { method: "DELETE" });
      } catch {
        setError("Remove failed (network).");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) || "Remove failed.",
        );
        return;
      }
      setConfirmingRemove(false);
      router.refresh();
    });
  };

  // ATTACHED VIEW --------------------------------------------------------
  if (current) {
    return (
      <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            {label}
          </p>
          <span className="rounded-full bg-[#D7ECDD] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#1E5A37]">
            Attached
          </span>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
          <SafeImage
            src={current.url}
            alt={current.altText}
            width={current.width}
            height={current.height}
            sizes="(max-width: 768px) 100vw, 600px"
            className="h-auto w-full"
          />
        </div>
        <dl className="mt-4 space-y-3 text-xs text-[#3B2F2F]/72">
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Alt text</dt>
            <dd className="mt-1 text-[#1F1918]">{current.altText}</dd>
          </div>
          {current.caption ? (
            <div>
              <dt className="font-semibold uppercase tracking-[0.12em]">Caption</dt>
              <dd className="mt-1 text-[#1F1918]">{current.caption}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-semibold uppercase tracking-[0.12em]">Dimensions</dt>
            <dd className="mt-1 text-[#1F1918]">
              {current.width} × {current.height}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (disabled || isPending) return;
              setConfirmingRemove(false);
              setError(null);
              fileInputRef.current?.click();
            }}
            disabled={disabled || isPending}
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Replace
          </button>
          {canGenerate && draftId && slot ? (
            <ImageGenerateButton
              draftId={draftId}
              slot={slot}
              providerConfigured={providerConfigured}
              label={generateLabel ?? "Regenerate with AI"}
            />
          ) : null}
          {!editingDetails ? (
            <button
              type="button"
              onClick={() => {
                if (disabled || isPending) return;
                setConfirmingRemove(false);
                setError(null);
                setEditAltText(current.altText);
                setEditCaption(current.caption ?? "");
                setEditingDetails(true);
              }}
              disabled={disabled || isPending}
              className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:opacity-50"
            >
              Edit details
            </button>
          ) : null}
          {confirmingRemove ? (
            <>
              <button
                type="button"
                onClick={submitRemove}
                disabled={disabled || isPending}
                className="rounded-full bg-[#6A3E31] px-4 py-2 text-sm font-medium text-[#F6F1EC] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Removing…" : "Confirm remove"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                disabled={isPending}
                className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              disabled={disabled || isPending}
              className="text-xs text-[#6A3E31] underline underline-offset-2 hover:text-[#5B342B] disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        {editingDetails ? (
          <div className="mt-5 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Edit image details
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label
                  htmlFor="edit-alt"
                  className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55"
                >
                  Alt text (required)
                </label>
                <input
                  id="edit-alt"
                  type="text"
                  value={editAltText}
                  onChange={(e) => setEditAltText(e.target.value)}
                  maxLength={500}
                  disabled={isPending}
                  className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-caption"
                  className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55"
                >
                  Caption (optional)
                </label>
                <input
                  id="edit-caption"
                  type="text"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  maxLength={500}
                  disabled={isPending}
                  className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submitMetadataEdit}
                  disabled={isPending}
                  className="rounded-full bg-[#2F2624] px-4 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPending ? "Saving…" : "Save details"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDetails(false);
                    setError(null);
                  }}
                  disabled={isPending}
                  className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-xs text-[#8A2F40]">{error}</p> : null}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_TYPES}
          onChange={(e) => {
            onFileInputChange(e);
            setConfirmingRemove(false);
          }}
          className="hidden"
        />
        {emptyState.mode === "selected" ? (
          <ReplacePanel
            previewUrl={emptyState.previewUrl}
            altText={altText}
            setAltText={setAltText}
            caption={caption}
            setCaption={setCaption}
            isPending={isPending}
            onSubmit={submitUpload}
            onCancel={resetSelection}
          />
        ) : null}
      </article>
    );
  }

  // EMPTY VIEW -----------------------------------------------------------
  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          {label}
        </p>
        <span className="rounded-full bg-[#EFE7DE] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/72">
          Not attached
        </span>
      </div>
      <p className="mt-2 text-xs text-[#3B2F2F]/65">{helperText}</p>

      {emptyState.mode === "idle" ? (
        <div
          role="button"
          tabIndex={disabled || isPending ? -1 : 0}
          aria-disabled={disabled || isPending}
          onClick={onPickClick}
          onKeyDown={(e) => {
            if (disabled || isPending) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPickClick();
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={[
            "mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-[#FBF7F3] p-8 text-sm text-[#3B2F2F]/70 transition-colors",
            dragOver
              ? "border-[#2F2624] bg-[#F2EAE4]"
              : "border-[#3B2F2F]/15 hover:border-[#3B2F2F]/30",
            disabled || isPending ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          ].join(" ")}
        >
          <span className="font-medium text-[#1F1918]">
            Drop an image or click to choose
          </span>
          <span className="text-xs text-[#3B2F2F]/55">
            JPEG, PNG, or WebP · up to 8 MB · 200×200 to 4000×4000
          </span>
        </div>
      ) : (
        <SelectionPanel
          previewUrl={emptyState.previewUrl}
          altText={altText}
          setAltText={setAltText}
          caption={caption}
          setCaption={setCaption}
          isPending={isPending}
          onSubmit={submitUpload}
          onCancel={resetSelection}
        />
      )}

      {canGenerate && draftId && slot && emptyState.mode === "idle" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#3B2F2F]/8 pt-4">
          <p className="text-xs text-[#3B2F2F]/65">Or generate one with AI:</p>
          <ImageGenerateButton
            draftId={draftId}
            slot={slot}
            providerConfigured={providerConfigured}
            label={generateLabel ?? "Generate with AI"}
          />
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-[#8A2F40]">{error}</p> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_TYPES}
        onChange={onFileInputChange}
        className="hidden"
      />
    </article>
  );
}

type SelectionPanelProps = {
  previewUrl: string;
  altText: string;
  setAltText: (v: string) => void;
  caption: string;
  setCaption: (v: string) => void;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

function SelectionPanel(props: SelectionPanelProps) {
  return (
    <div className="mt-4 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.previewUrl}
          alt=""
          className="h-auto w-full"
        />
      </div>
      <UploadFormFields {...props} submitLabel="Upload and attach" />
    </div>
  );
}

function ReplacePanel(props: SelectionPanelProps) {
  return (
    <div className="mt-5 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
        Replace with new image
      </p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.previewUrl}
          alt=""
          className="h-auto w-full"
        />
      </div>
      <div className="mt-3">
        <UploadFormFields {...props} submitLabel="Replace" />
      </div>
    </div>
  );
}

function UploadFormFields({
  altText,
  setAltText,
  caption,
  setCaption,
  isPending,
  onSubmit,
  onCancel,
  submitLabel,
}: SelectionPanelProps & { submitLabel: string }) {
  return (
    <>
      <div>
        <label
          htmlFor="media-alt"
          className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55"
        >
          Alt text (required)
        </label>
        <input
          id="media-alt"
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          maxLength={500}
          disabled={isPending}
          placeholder="Describe the image for screen readers."
          className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
        />
      </div>
      <div>
        <label
          htmlFor="media-caption"
          className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55"
        >
          Caption (optional)
        </label>
        <input
          id="media-caption"
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={500}
          disabled={isPending}
          placeholder="Small italic line shown below the image."
          className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className="rounded-full bg-[#2F2624] px-5 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
