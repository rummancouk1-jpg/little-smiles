import Link from "next/link";

import { cn } from "@/lib/utils";

type PakistanServiceNotesProps = {
  variant: "hero" | "panel";
  className?: string;
};

/**
 * Shared Pakistan intent copy: shipping coverage, timelines, WhatsApp ordering,
 * returns — aligned with policy pages for trust + SEO.
 */
export function PakistanServiceNotes({
  variant,
  className,
}: PakistanServiceNotesProps) {
  if (variant === "hero") {
    return (
      <div
        className={cn(
          "mt-4 space-y-3 text-sm leading-relaxed text-ink-base/68 sm:text-[0.9375rem]",
          className,
        )}
      >
        <p>
          We ship{" "}
          <strong className="font-medium text-ink-walnut/88">
            across Pakistan
          </strong>
          — dispatch usually within{" "}
          <strong className="font-medium text-ink-walnut/88">24–48 hours</strong>
          ; most orders arrive in{" "}
          <strong className="font-medium text-ink-walnut/88">
            2–5 business days
          </strong>{" "}
          (city-dependent).
        </p>
        <p>
          Order from any product page via{" "}
          <strong className="font-medium text-ink-walnut/88">WhatsApp</strong>{" "}
          with a prefilled message (product, price, link). Wrong or damaged
          items: message us within{" "}
          <strong className="font-medium text-ink-walnut/88">48 hours</strong>{" "}
          of delivery — see{" "}
          <Link
            href="/shipping-policy"
            className="font-medium text-ink-walnut underline decoration-ink-base/28 underline-offset-[5px] hover:decoration-ink-walnut/55"
          >
            shipping
          </Link>{" "}
          &{" "}
          <Link
            href="/return-refund-policy"
            className="font-medium text-ink-walnut underline decoration-ink-base/28 underline-offset-[5px] hover:decoration-ink-walnut/55"
          >
            returns
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "rounded-2xl border border-ink-base/10 bg-surface-panel/90 p-5 text-left shadow-[0_14px_36px_-28px_rgba(59,47,47,0.35)] sm:p-6",
        className,
      )}
      aria-labelledby="pk-service-heading"
    >
      <h2
        id="pk-service-heading"
        className="text-xs font-medium uppercase tracking-[0.18em] text-ink-base/52"
      >
        Delivery & support — Pakistan
      </h2>
      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-base/78">
        <li>
          <span className="font-semibold text-ink-espresso">Where we ship:</span>{" "}
          Nationwide — major cities and towns across Pakistan (courier-dependent
          timelines for remote areas).
        </li>
        <li>
          <span className="font-semibold text-ink-espresso">Timelines:</span>{" "}
          Dispatch typically{" "}
          <strong className="font-medium text-ink-walnut">24–48 hours</strong>{" "}
          after order confirmation; delivery commonly{" "}
          <strong className="font-medium text-ink-walnut">
            2–5 business days
          </strong>{" "}
          after dispatch.
        </li>
        <li>
          <span className="font-semibold text-ink-espresso">How to order:</span>{" "}
          Use{" "}
          <strong className="font-medium text-ink-walnut">WhatsApp</strong> from
          each product page — your message includes product name, price, and
          link so we can confirm stock quickly.
        </li>
        <li>
          <span className="font-semibold text-ink-espresso">Returns & issues:</span>{" "}
          Damaged or incorrect items — contact us within{" "}
          <strong className="font-medium text-ink-walnut">48 hours</strong> with
          photos. Full detail in our policies below.
        </li>
      </ul>
      <p className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-ink-base/10 pt-4 text-xs font-medium uppercase tracking-[0.12em] text-ink-base/58">
        <Link
          href="/shipping-policy"
          className="text-ink-walnut underline decoration-ink-base/22 underline-offset-[5px] transition-colors hover:decoration-ink-walnut/45"
        >
          Shipping policy
        </Link>
        <Link
          href="/return-refund-policy"
          className="text-ink-walnut underline decoration-ink-base/22 underline-offset-[5px] transition-colors hover:decoration-ink-walnut/45"
        >
          Returns & refunds
        </Link>
        <Link
          href="/contact"
          className="text-ink-walnut underline decoration-ink-base/22 underline-offset-[5px] transition-colors hover:decoration-ink-walnut/45"
        >
          Contact & WhatsApp hours
        </Link>
      </p>
    </aside>
  );
}
