// Operator-facing draft creation entry point. A calm form that takes a
// topic and triggers an in-app AI generation through the
// /api/admin/contentops/drafts/generate route. On success the form's
// client component redirects the operator straight to the new draft's
// review page so reading and approval is one tap away.
//
// This is the editorial loop's entry surface — keyword in, draft out.
// Commit S (keyword queue) will add an additional path that pre-fills
// the topic field from a queued suggestion.

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { DraftCreateForm } from "@/components/contentops/draft-create-form";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";

export const dynamic = "force-dynamic";

export default async function NewDraftPage() {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">{adminConfigHelpText()}</p>
        </section>
      </main>
    );
  }

  const adminSession = await getAdminSessionFromPage();
  if (!adminSession) {
    redirect(`/admin/login?next=${encodeURIComponent("/admin/contentops/new")}`);
  }

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
                Editorial
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Signed in as {adminSession.actorLabel}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Create draft
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                Start a new article. AI writes the first draft in the brand voice; you
                review before anything moves forward.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/contentops"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Back to queue
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        <DraftCreateForm generateHref="/api/admin/contentops/drafts/generate" />
      </section>
    </main>
  );
}
