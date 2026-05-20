import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import {
  buildSeoIntelligenceReport,
  type Diagnostic,
  type Severity,
  type SubjectReport,
} from "@/lib/seo-intelligence";
import type { PinterestSubjectReport } from "@/lib/seo-intelligence/pinterest-readiness";

export const dynamic = "force-dynamic";

function severityClass(severity: Severity): string {
  if (severity === "critical") return "bg-[#F8E8EA] text-[#8A2F40]";
  if (severity === "warning") return "bg-[#FBEEDE] text-[#7A4A12]";
  if (severity === "info") return "bg-[#E7EEF7] text-[#1F3F66]";
  return "bg-[#E7F4EA] text-[#2E6A41]";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DiagnosticItem({ d }: { d: Diagnostic }) {
  return (
    <li className="flex items-start gap-3 border-b border-[#3B2F2F]/8 py-2 last:border-b-0">
      <span
        className={[
          "mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          severityClass(d.severity),
        ].join(" ")}
      >
        {d.severity}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1F1918]">{d.message}</p>
        <p className="mt-0.5 text-xs text-[#3B2F2F]/72">Why: {d.derivation}</p>
        {d.hint ? <p className="mt-0.5 text-xs text-[#3B2F2F]/65">Hint: {d.hint}</p> : null}
      </div>
    </li>
  );
}

function SubjectCard({ report }: { report: SubjectReport }) {
  if (report.diagnostics.length === 0) {
    return (
      <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
        <p className="text-sm font-medium text-[#1F1918]">{report.subject.title}</p>
        <p className="mt-1 text-xs text-[#3B2F2F]/65">
          {report.subject.kind} · {report.subject.slug}
        </p>
        <p className="mt-2 inline-flex rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E6A41]">
          No diagnostics
        </p>
      </article>
    );
  }
  return (
    <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
      <p className="text-sm font-medium text-[#1F1918]">{report.subject.title}</p>
      <p className="mt-1 text-xs text-[#3B2F2F]/65">
        {report.subject.kind} · {report.subject.slug}
      </p>
      <ul className="mt-3">
        {report.diagnostics.map((d, idx) => (
          <DiagnosticItem key={idx} d={d} />
        ))}
      </ul>
    </article>
  );
}

function PinterestCard({ report }: { report: PinterestSubjectReport }) {
  const m = report.image;
  return (
    <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
      <p className="text-sm font-medium text-[#1F1918]">{report.subject.title}</p>
      <p className="mt-1 text-xs text-[#3B2F2F]/65">
        {report.subject.kind} · {report.subject.slug}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[#3B2F2F]/74">
        <dt>Image</dt>
        <dd className="truncate">{m.filePath}</dd>
        <dt>Dimensions</dt>
        <dd>{m.width && m.height ? `${m.width} × ${m.height}` : "—"}</dd>
        <dt>Ratio</dt>
        <dd>{m.ratio ? m.ratio.toFixed(2) : "—"}</dd>
        <dt>Verdict</dt>
        <dd>{m.verdict.replace(/_/g, " ")}</dd>
      </dl>
      {report.diagnostics.length > 0 ? (
        <ul className="mt-3">
          {report.diagnostics.map((d, idx) => (
            <DiagnosticItem key={idx} d={d} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 inline-flex rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E6A41]">
          No diagnostics
        </p>
      )}
    </article>
  );
}

function summariseSeverity(diagnostics: Diagnostic[]): Severity {
  if (diagnostics.some((d) => d.severity === "critical")) return "critical";
  if (diagnostics.some((d) => d.severity === "warning")) return "warning";
  if (diagnostics.some((d) => d.severity === "info")) return "info";
  return "ok";
}

export default async function SeoIntelligencePage() {
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

  const session = await getAdminSessionFromPage();
  if (!session) {
    redirect("/admin/login?next=%2Fadmin%2Fseo");
  }

  const report = await buildSeoIntelligenceReport();

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Private Admin</p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {session.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                SEO Intelligence
              </h1>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Generated {formatDateTime(report.generatedAt)} — every signal derives from real repo data or local
                images. No external calls.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/readiness"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Readiness
              </Link>
              <Link
                href="/admin/contentops"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                ContentOps
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        {/* Provider connection states */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">External providers</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Search Console + GA4 power the signals this layer cannot derive locally (traffic, queries, CTR).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
              <p className="text-sm font-medium text-[#1F1918]">Search Console</p>
              {report.providers.searchConsole.connected ? (
                <>
                  <p className="mt-1 inline-flex rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E6A41]">
                    Connected
                  </p>
                  <p className="mt-2 text-xs text-[#3B2F2F]/72">Site: {report.providers.searchConsole.siteUrl}</p>
                </>
              ) : (
                <>
                  <p className="mt-1 inline-flex rounded-full bg-[#FBEEDE] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#7A4A12]">
                    Not connected
                  </p>
                  <p className="mt-2 text-xs text-[#3B2F2F]/72">{report.providers.searchConsole.reason}</p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/60">
                    Missing: {report.providers.searchConsole.missingEnv.join(", ")}
                  </p>
                </>
              )}
            </article>
            <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
              <p className="text-sm font-medium text-[#1F1918]">GA4 Data API</p>
              {report.providers.ga4.connected ? (
                <>
                  <p className="mt-1 inline-flex rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E6A41]">
                    Connected
                  </p>
                  <p className="mt-2 text-xs text-[#3B2F2F]/72">Property: {report.providers.ga4.propertyId}</p>
                </>
              ) : (
                <>
                  <p className="mt-1 inline-flex rounded-full bg-[#FBEEDE] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#7A4A12]">
                    Not connected
                  </p>
                  <p className="mt-2 text-xs text-[#3B2F2F]/72">{report.providers.ga4.reason}</p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/60">
                    Missing: {report.providers.ga4.missingEnv.join(", ")}
                  </p>
                </>
              )}
            </article>
          </div>
        </section>

        {/* Internal linking */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Internal linking</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Orphan / weak-link detection across the live blog + product graph.
          </p>

          {report.internalLinking.globalDiagnostics.length > 0 ? (
            <ul className="mt-3">
              {report.internalLinking.globalDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog posts</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.internalLinking.blogReports.map((r) => (
              <SubjectCard key={r.subject.slug} report={r} />
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Cluster strength by category</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {report.internalLinking.clusterStrength.map((c) => (
              <li
                key={c.category}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3"
              >
                <div>
                  <p className="text-sm font-medium text-[#1F1918]">{c.category}</p>
                  <p className="text-xs text-[#3B2F2F]/65">
                    {c.productCount} product{c.productCount === 1 ? "" : "s"} · {c.blogPostCount} post
                    {c.blogPostCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/72">{c.notes}</p>
                </div>
                <span
                  className={[
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    c.level === "strong"
                      ? "bg-[#E7F4EA] text-[#2E6A41]"
                      : c.level === "balanced"
                        ? "bg-[#E7EEF7] text-[#1F3F66]"
                        : c.level === "weak"
                          ? "bg-[#FBEEDE] text-[#7A4A12]"
                          : "bg-[#F8E8EA] text-[#8A2F40]",
                  ].join(" ")}
                >
                  {c.level}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Topic grouping */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Topic grouping (keyword overlap)</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Deterministic Jaccard similarity on the keywords[] field. No AI, no opaque scores.
          </p>
          {report.topicGrouping.groups.length === 0 ? (
            <ul className="mt-3">
              {report.topicGrouping.globalDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : (
            <ul className="mt-3 space-y-3">
              {report.topicGrouping.groups.map((g) => (
                <li key={g.id} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
                  <p className="text-sm font-semibold text-[#1F1918]">{g.members.length} posts grouped</p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/65">{g.derivation}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-[#1F1918]">
                    {g.members.map((m) => (
                      <li key={m.slug}>{m.title}</li>
                    ))}
                  </ul>
                  {g.sharedKeywords.length > 0 ? (
                    <p className="mt-2 text-xs text-[#3B2F2F]/72">
                      Shared keywords: {g.sharedKeywords.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {report.topicGrouping.isolatedPosts.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Isolated posts</h3>
              <ul className="mt-2 space-y-1 text-sm text-[#3B2F2F]/74">
                {report.topicGrouping.isolatedPosts.map((p) => (
                  <li key={p.slug}>
                    <span className="text-[#1F1918]">{p.title}</span>
                    <span className="ml-2 text-xs text-[#3B2F2F]/60">— {p.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* Content decay */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Content decay (local signals)</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Age, word count, sections, anchor product, image freshness. Traffic-decay signals require the GSC + GA4
            connections above.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.contentDecay.blogReports.map((r) => (
              <article key={r.subject.slug} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
                <p className="text-sm font-medium text-[#1F1918]">{r.subject.title}</p>
                <p className="mt-1 text-xs text-[#3B2F2F]/65">
                  {r.ageInDays} days old · {r.wordCount} words · {r.sectionCount} sections ·{" "}
                  {r.hasAnchorProduct ? "has anchor" : "no anchor"}
                </p>
                <ul className="mt-3">
                  {r.diagnostics.map((d, idx) => (
                    <DiagnosticItem key={idx} d={d} />
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <details className="mt-4 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#1F1918]">
              What this engine cannot see ({report.contentDecay.knownBlindSpots.length})
            </summary>
            <ul className="mt-2 list-disc pl-5 text-xs text-[#3B2F2F]/74">
              {report.contentDecay.knownBlindSpots.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </details>
        </section>

        {/* Pinterest readiness */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Pinterest readiness</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Image dimensions read directly from /public via sharp. Pin verdict matches Pinterest's published ratio
            guidance (2:3 ideal).
          </p>
          {report.pinterest.globalDiagnostics.length > 0 ? (
            <ul className="mt-3">
              {report.pinterest.globalDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog hero images</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.pinterest.blogReports.map((r) => (
              <PinterestCard key={r.subject.slug} report={r} />
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Product images</h3>
          <details className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#1F1918]">
              {report.pinterest.productReports.length} product images analysed
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.pinterest.productReports.map((r) => (
                <PinterestCard key={r.subject.slug} report={r} />
              ))}
            </div>
          </details>
        </section>

        {/* Metadata coverage */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Metadata coverage</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Length checks for title / description, plus the keywords[] field on each blog post.
          </p>
          {report.metadataCoverage.siteLevelDiagnostics.length > 0 ? (
            <ul className="mt-3">
              {report.metadataCoverage.siteLevelDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog posts</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.metadataCoverage.blogReports.map((r) => {
              const top = summariseSeverity(r.diagnostics);
              return (
                <article key={r.subject.slug} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1F1918]">{r.subject.title}</p>
                      <p className="mt-1 text-xs text-[#3B2F2F]/65">{r.subject.slug}</p>
                    </div>
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        severityClass(top),
                      ].join(" ")}
                    >
                      {top}
                    </span>
                  </div>
                  {r.diagnostics.length > 0 ? (
                    <ul className="mt-3">
                      {r.diagnostics.map((d, idx) => (
                        <DiagnosticItem key={idx} d={d} />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[#3B2F2F]/65">All metadata lengths within recommended ranges.</p>
                  )}
                </article>
              );
            })}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Products (with diagnostics)</h3>
          <details className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#1F1918]">
              {report.metadataCoverage.productReports.filter((r) => r.diagnostics.length > 0).length} of{" "}
              {report.metadataCoverage.productReports.length} products flagged
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.metadataCoverage.productReports
                .filter((r) => r.diagnostics.length > 0)
                .map((r) => (
                  <SubjectCard key={r.subject.slug} report={r} />
                ))}
            </div>
          </details>
        </section>
      </section>
    </main>
  );
}
