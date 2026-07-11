"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { cn } from "@/lib/utils";

/**
 * The private admin cockpit's top chrome. Replaces the customer navbar on
 * /admin routes: brand mark, the section tabs, and a signed-in indicator +
 * sign out. Dark-first via the shipped dark palette tokens. Presentation only;
 * the sign-out logic lives in AdminLogoutButton and is untouched.
 */
const TABS = [
  { label: "SEO Intelligence", href: "/admin/seo" },
  { label: "Keywords", href: "/admin/keywords" },
  { label: "ContentOps", href: "/admin/contentops" },
  { label: "Readiness", href: "/admin/readiness" },
  { label: "Notifications", href: "/admin/notifications" },
  { label: "Report", href: "/admin/report" },
  { label: "Audit", href: "/admin/audit" },
] as const;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminCommandBar({ actorLabel }: { actorLabel: string | null }) {
  const pathname = usePathname();

  // The login screen is behind the cockpit chrome but shouldn't show the nav.
  if (pathname?.startsWith("/admin/login")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-base/12 bg-surface-page/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brass/50"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-brass text-accent-brass-ink shadow-[0_8px_20px_-12px_rgba(201,154,82,0.8)]">
            <span className="font-heading text-lg leading-none">S</span>
          </span>
          <span className="leading-tight">
            <span className="block font-heading text-lg text-ink-strong">Little Smiles</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.28em] text-accent-brass">
              Command
            </span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1.5">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200",
                  active
                    ? "bg-accent-brass text-accent-brass-ink"
                    : "text-ink-muted hover:bg-surface-panel hover:text-ink-strong",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {actorLabel ? (
            <span className="hidden items-center gap-2 rounded-full border border-ink-base/12 bg-surface-card px-3 py-1.5 text-xs text-ink-muted sm:inline-flex">
              <span className="size-1.5 rounded-full bg-tone-green" aria-hidden />
              <span className="max-w-[16ch] truncate text-ink-strong">{actorLabel}</span>
            </span>
          ) : null}
          <AdminLogoutButton className="rounded-full border border-ink-base/14 bg-surface-card px-3.5 py-1.5 text-xs font-medium text-ink-strong transition-colors hover:bg-surface-panel disabled:cursor-not-allowed disabled:opacity-70" />
        </div>
      </div>
    </header>
  );
}
