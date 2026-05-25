// Shared top-bar navigation for the admin operating system. Renders the
// four primary sections — SEO Intelligence, Readiness, ContentOps,
// Notifications — with the active pill highlighted. Designed to be
// dropped into any admin page header without duplicating link styles.

import Link from "next/link";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

export type AdminSection =
  | "seo"
  | "keywords"
  | "readiness"
  | "contentops"
  | "notifications"
  | "report"
  | "audit";

type NavEntry = {
  key: AdminSection;
  label: string;
  href: string;
};

const ENTRIES: NavEntry[] = [
  { key: "seo", label: "SEO Intelligence", href: "/admin/seo" },
  { key: "keywords", label: "Keywords", href: "/admin/keywords" },
  { key: "contentops", label: "ContentOps", href: "/admin/contentops" },
  { key: "readiness", label: "Readiness", href: "/admin/readiness" },
  { key: "notifications", label: "Notifications", href: "/admin/notifications" },
  { key: "report", label: "Report", href: "/admin/report" },
  { key: "audit", label: "Audit", href: "/admin/audit" },
];

type Props = {
  active: AdminSection;
  /** Optional extra action chips (e.g. "Back to draft") rendered before logout. */
  extraActions?: React.ReactNode;
};

export function AdminSectionNav({ active, extraActions }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ENTRIES.map((entry) => {
        const isActive = entry.key === active;
        const classes = isActive
          ? "rounded-full bg-[#2F2624] px-3.5 py-1.5 text-xs font-medium text-[#F6F1EC]"
          : "rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]";
        return (
          <Link key={entry.key} href={entry.href} className={classes} aria-current={isActive ? "page" : undefined}>
            {entry.label}
          </Link>
        );
      })}
      {extraActions ? <div className="ml-1 flex flex-wrap items-center gap-2">{extraActions}</div> : null}
      <AdminLogoutButton />
    </div>
  );
}
