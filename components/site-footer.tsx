import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { whatsappBaseUrl } from "@/lib/products";

type FooterLink = { label: string; href: string };
type FooterColumn = { eyebrow: string; links: FooterLink[] };

const footerColumns: FooterColumn[] = [
  {
    eyebrow: "Shop",
    links: [
      { label: "Shop all", href: "/shop" },
      { label: "Best Sellers", href: "/best-sellers" },
      { label: "Reviews", href: "/reviews" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    eyebrow: "Help",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Track order", href: "/track-order" },
    ],
  },
  {
    eyebrow: "Policies",
    links: [
      { label: "Shipping", href: "/shipping-policy" },
      { label: "Return & Refund", href: "/return-refund-policy" },
      { label: "Privacy", href: "/privacy-policy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

const infoChips = [
  "Dispatch: 24-48 hours",
  "Delivery: 2-5 business days",
  "Return support: within 48 hours",
  "WhatsApp replies: 10am-10pm PKT",
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-base/8 bg-surface-card/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pt-12 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-14 lg:px-8 lg:gap-12 lg:pt-16">
        <div className="flex flex-wrap gap-2.5 text-xs text-ink-base/70 sm:gap-2">
          {infoChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-ink-base/12 bg-white/55 px-3 py-1"
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
          <div className="lg:w-[18rem] lg:shrink-0">
            <p className="text-base font-semibold text-ink-espresso">Little Smiles</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-base/72">
              Premium baby essentials for families in Pakistan.
            </p>
            <Link
              href={whatsappBaseUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink-base/16 bg-white/70 px-4 py-2 text-sm font-medium text-ink-walnut transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-ink-base/28 hover:bg-surface-hover"
            >
              <MessageCircle className="size-4" strokeWidth={2} aria-hidden />
              Message on WhatsApp
            </Link>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:flex-1 lg:gap-10"
          >
            {footerColumns.map((column) => (
              <div key={column.eyebrow}>
                <p className="eyebrow">{column.eyebrow}</p>
                <ul className="mt-4 flex flex-col gap-1 text-sm text-ink-base/74">
                  {column.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="inline-flex min-h-9 items-center transition-colors hover:text-ink-walnut"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="border-t border-ink-base/8 pt-6 text-xs text-ink-base/55">
          © {new Date().getFullYear()} Little Smiles. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
