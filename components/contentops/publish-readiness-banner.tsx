// Publish-readiness banner. Driven by the deterministic draft validator
// + the existing publish-prep conflict list. Shows a "Not ready" warning
// when thin content, missing metadata, missing image, or weak schema is
// detected — but never blocks the operator from proceeding. The button
// still works; the human reads the warning and decides.

import type { DraftBadge } from "@/lib/contentops/draft-validation";

type Props = {
  badges: DraftBadge[];
  /** Optional secondary signals from the publish-prep engine (warning/error severity). */
  publishWarnings?: { code: string; message: string; severity: "warning" | "error" }[];
};

const BLOCKING_KEYS: DraftBadge["key"][] = [
  "thin_content",
  "missing_metadata",
  "missing_hero_image",
  "schema_invalid",
];

function isBlocker(badge: DraftBadge): boolean {
  return BLOCKING_KEYS.includes(badge.key) && badge.severity !== "ok" && badge.severity !== "info";
}

export function PublishReadinessBanner({ badges, publishWarnings = [] }: Props) {
  const blockers = badges.filter(isBlocker);
  const errors = publishWarnings.filter((w) => w.severity === "error");
  const warnings = publishWarnings.filter((w) => w.severity === "warning");
  const notReady = blockers.length > 0 || errors.length > 0;

  if (!notReady && warnings.length === 0) {
    return (
      <section className="rounded-3xl border border-[#2E6A41]/25 bg-[#EAF5EE] p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#1E5A37]">
          Ready to publish
        </p>
        <p className="mt-1 text-sm text-[#1F1918]">
          All deterministic checks passed. You can prepare publish with confidence.
        </p>
      </section>
    );
  }

  const palette = notReady
    ? {
        container: "border-[#8A2F40]/25 bg-[#FBEEF1]",
        label: "text-[#5E1C29]",
      }
    : {
        container: "border-[#8A6A2F]/25 bg-[#FBF5EA]",
        label: "text-[#5E4A1C]",
      };

  return (
    <section className={`rounded-3xl border p-5 sm:p-6 ${palette.container}`}>
      <p className={`text-xs font-medium uppercase tracking-[0.16em] ${palette.label}`}>
        {notReady ? "Not ready — review before publishing" : "Publish with caution"}
      </p>
      <p className="mt-1 text-sm text-[#1F1918]">
        Prepare publish stays available; this banner surfaces what to fix first.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-[#1F1918]">
        {blockers.map((badge) => (
          <li key={`b-${badge.key}`} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A2F40]" />
            <div>
              <span className="font-medium">{badge.label}.</span>{" "}
              <span className="text-[#3B2F2F]/82">{badge.detail}</span>
            </div>
          </li>
        ))}
        {errors.map((w, idx) => (
          <li key={`e-${idx}`} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A2F40]" />
            <div>
              <span className="font-medium">{w.code}.</span>{" "}
              <span className="text-[#3B2F2F]/82">{w.message}</span>
            </div>
          </li>
        ))}
        {warnings.map((w, idx) => (
          <li key={`w-${idx}`} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A6A2F]" />
            <div>
              <span className="font-medium">{w.code}.</span>{" "}
              <span className="text-[#3B2F2F]/82">{w.message}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Coming in the next phase — assisted draft improvement."
          className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#3B2F2F]/45"
        >
          Improve draft (coming soon)
        </button>
      </div>
    </section>
  );
}
