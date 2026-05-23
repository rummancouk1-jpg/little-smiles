// Single source of truth for which page paths count as "admin / internal"
// when reporting client-facing GA4 metrics. Used by snapshot-insights to
// split rows into the public-facing slice (what real visitors do) and
// the admin slice (what the operator is doing inside the admin console).
//
// We intentionally exclude:
//   - /admin/* (every admin page: seo, contentops, readiness, audit, etc.)
//   - /admin (exact, no trailing slash)
//   - /api/admin/* (admin API routes — should never show up in page_path
//     reports but a noisy collector / chrome-extension might surface them)
//
// We deliberately do NOT exclude:
//   - /api/* (cron + public endpoints — typically zero traffic, but if it
//     ever rises it is real usage worth seeing)
//   - /robots.txt, /sitemap.xml, /apple-icon.png (crawler / browser
//     activity — represents real bot/browser hits)

const ADMIN_PREFIXES = ["/admin/", "/api/admin/"] as const;

export const ADMIN_PATH_EXCLUSION_NOTE =
  "Admin/internal paths (/admin/*, /api/admin/*) excluded from client-facing GA4 insights. Raw snapshot rows are not modified.";

export function isAdminPagePath(pagePath: string): boolean {
  if (!pagePath) return false;
  if (pagePath === "/admin") return true;
  for (const prefix of ADMIN_PREFIXES) {
    if (pagePath.startsWith(prefix)) return true;
  }
  return false;
}
