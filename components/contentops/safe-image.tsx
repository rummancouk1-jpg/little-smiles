// Defensive next/image wrapper. The ContentOps admin can end up
// rendering arbitrary image URLs sourced from drafts in Supabase, AI
// output, seed data, or operator edits. next/image throws a hard 500
// when an unconfigured hostname appears in src, taking the whole admin
// page down with it — that's the failure mode this component prevents.
//
// Decision logic:
//   - Relative path starting with "/"        → next/image (safe, no host).
//   - Absolute URL on the allow-list below   → next/image.
//   - Anything else (foreign host, malformed
//     URL, data:, javascript:, mailto:, etc.) → calm <Placeholder>.
//
// The allow-list mirrors next.config.ts → images.remotePatterns. Keep
// the two in sync when adding a new trusted host. We duplicate the
// list here (rather than importing) because next.config.ts runs at
// build time and isn't reachable from a client component.

"use client";

import Image, { type ImageProps } from "next/image";

// Hostnames trusted by next.config.ts. Wildcard "*.supabase.co" is
// expanded to "endsWith('.supabase.co')" below.
const ALLOWED_EXACT_HOSTS = new Set<string>([
  "littlesmiles.co",
  "www.littlesmiles.co",
  "littlesmiles.pk",
  "www.littlesmiles.pk",
]);

const ALLOWED_HOST_SUFFIXES: string[] = [".supabase.co"];

function isTrustedSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  const trimmed = src.trim();
  if (trimmed.length === 0) return false;

  // Relative path checked into `public/` — always safe; next/image does
  // not invoke the hostname check for these.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;

  // Anything else must parse as an http/https URL on the allow-list.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  if (ALLOWED_EXACT_HOSTS.has(host)) return true;
  for (const suffix of ALLOWED_HOST_SUFFIXES) {
    if (host.endsWith(suffix)) return true;
  }
  return false;
}

type SafeImageProps = Omit<ImageProps, "src"> & {
  src: string | undefined | null;
};

/**
 * Drop-in replacement for next/image that never crashes on an
 * unsupported hostname. When the src can't be rendered safely, the
 * caller-provided dimensions are honored so layout doesn't jump.
 */
export function SafeImage({ src, alt, ...rest }: SafeImageProps) {
  if (isTrustedSrc(src)) {
    // src has been validated as a non-empty trusted string above.
    return <Image src={src as string} alt={alt} {...rest} />;
  }
  return <ImagePlaceholder alt={alt} {...rest} />;
}

type PlaceholderProps = Omit<ImageProps, "src">;

function ImagePlaceholder({ alt, width, height, className }: PlaceholderProps) {
  // Reserve the same box the image would have occupied so the
  // surrounding layout stays calm. Aspect ratio comes from width/height
  // when both are numeric; otherwise we fall back to 4:3.
  const w = typeof width === "number" ? width : 1600;
  const h = typeof height === "number" ? height : 900;
  const aspect = `${w} / ${h}`;
  return (
    <div
      role="img"
      aria-label={typeof alt === "string" && alt.length > 0 ? alt : "Image preview unavailable"}
      style={{ aspectRatio: aspect }}
      className={[
        "flex w-full items-center justify-center bg-[#FBF7F3] text-center text-xs text-[#3B2F2F]/55",
        className ?? "",
      ].join(" ")}
    >
      <span className="px-4 py-6 leading-relaxed">
        Image preview unavailable.
        <br />
        Source isn&rsquo;t on the trusted host list.
      </span>
    </div>
  );
}

export { isTrustedSrc };
