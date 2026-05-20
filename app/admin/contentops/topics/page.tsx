// Editorial planning surface. The operator scans the queue, decides
// what to write next, and either generates a draft inline or archives
// the topic. Visual language matches the editorial queue (rounded
// cards, cream backdrop, sage/blue/clay pills) so the two surfaces
// feel like the same operating system.

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { TopicCard } from "@/components/contentops/topic-card";
import { getTopicStatusFilterLabel } from "@/components/contentops/topic-labels";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import {
  isTopicStatus,
  listTopics,
  TOPIC_STATUSES,
  type Topic,
  type TopicStatus,
} from "@/lib/contentops/topics-store";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export const dynamic = "force-dynamic";

export default async function TopicsQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawStatus = asSingle(params.status);
  // Default landing view is the queue — the actionable bucket. "All"
  // remains opt-in via ?status=all.
  const showAll = rawStatus === "all";
  const status: TopicStatus | undefined = showAll
    ? undefined
    : rawStatus && isTopicStatus(rawStatus)
      ? rawStatus
      : "queued";

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
    const nextQuery = showAll
      ? "?status=all"
      : rawStatus && isTopicStatus(rawStatus)
        ? `?status=${rawStatus}`
        : "";
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/contentops/topics${nextQuery}`)}`);
  }

  let topics: Topic[] = [];
  let listError: string | null = null;
  try {
    topics = await listTopics(status);
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load topics.";
  }

  const activeFilter: TopicStatus | "all" = showAll ? "all" : (status as TopicStatus);

  const baseHref = "/admin/contentops/topics";
  const filterHref = (s: TopicStatus | "all") =>
    s === "queued" ? baseHref : `${baseHref}?status=${s}`;

  const pillClass = (s: TopicStatus | "all") =>
    [
      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      activeFilter === s
        ? "bg-[#2F2624] text-[#F6F1EC]"
        : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]",
    ].join(" ");

  const emptyLabel =
    activeFilter === "queued"
      ? "Nothing queued. Add a topic to start the next article."
      : activeFilter === "snoozed"
        ? "Nothing saved for later."
        : activeFilter === "drafted"
          ? "No topics waiting in draft."
          : activeFilter === "published"
            ? "No topics live yet."
            : activeFilter === "archived"
              ? "No archived topics."
              : "No topics yet.";

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
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
                Topic queue
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                What we&rsquo;re writing about next. Generate a draft directly from any
                queued topic, or add a new one.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/contentops/topics/new"
                className="rounded-full bg-[#2F2624] px-4 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90"
              >
                + Add topic
              </Link>
              <Link
                href="/admin/contentops"
                className="text-xs text-[#3B2F2F]/55 underline underline-offset-2 hover:text-[#3B2F2F]"
              >
                ← Overview
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        {listError ? (
          <article className="rounded-3xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-5 text-sm text-[#5E1C29] sm:p-6">
            <p className="font-medium">Unable to load topics</p>
            <p className="mt-1 text-xs">{listError}</p>
          </article>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {TOPIC_STATUSES.map((s) => (
            <Link key={s} href={filterHref(s)} className={pillClass(s)}>
              {getTopicStatusFilterLabel(s)}
            </Link>
          ))}
          <Link href={filterHref("all")} className={pillClass("all")}>
            All
          </Link>
        </div>

        {topics.length === 0 ? (
          <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 text-sm text-[#3B2F2F]/72 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
            {emptyLabel}
          </article>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
