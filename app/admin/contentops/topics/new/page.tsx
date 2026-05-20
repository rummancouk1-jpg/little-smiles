// Add-topic form page. Calm editorial entry surface. Related-category
// options come from the BlogPost schema's relatedProductCategory enum
// so the dropdown stays in sync with what the system actually knows
// how to render.

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { TopicCreateForm } from "@/components/contentops/topic-create-form";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { blogRelatedProductCategorySchema } from "@/lib/contentops/blog-schema";

export const dynamic = "force-dynamic";

export default async function NewTopicPage() {
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
    redirect(
      `/admin/login?next=${encodeURIComponent("/admin/contentops/topics/new")}`,
    );
  }

  // Pulled from the canonical schema enum so adding a category there
  // automatically extends the form.
  const relatedCategoryOptions = [...blogRelatedProductCategorySchema.options];

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
                Editorial planning
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Signed in as {adminSession.actorLabel}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Add topic
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                Queue a topic for a future article. When you&rsquo;re ready, generate a
                draft directly from the queue.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/contentops/topics"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Back to topics
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        <TopicCreateForm
          createHref="/api/admin/contentops/topics"
          relatedCategoryOptions={relatedCategoryOptions}
        />
      </section>
    </main>
  );
}
