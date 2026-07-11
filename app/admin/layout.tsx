import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminCommandBar } from "@/components/admin/admin-command-bar";
import { getAdminSessionFromPage } from "@/lib/admin-auth";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

/**
 * Admin cockpit shell. Forces the dark palette (`.dark` on the wrapper) so the
 * private tool is dark-first regardless of the customer theme toggle, and
 * supplies its own chrome — the customer navbar/footer are gated out on /admin.
 * Individual page CONTENT is unchanged here; it is redesigned page-by-page.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSessionFromPage();

  return (
    <div className="dark admin-cockpit min-h-screen bg-surface-page text-ink-strong">
      <AdminCommandBar actorLabel={session?.actorLabel ?? null} />
      {children}
    </div>
  );
}
