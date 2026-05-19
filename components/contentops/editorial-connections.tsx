// Operator-facing card surfacing related articles + products. Calm
// editorial framing, no SEO scoring chrome. Each item shows a single
// one-line reason composed by the relationships engine; the operator
// uses these as ideas when refining the article rather than as
// machine-enforced links.
//
// Hides itself when there are no connections — empty editorial graph
// is a legitimate quiet state, not a deficiency to highlight.
//
// Links open in a new tab so the operator stays in the publishing
// flow.

import Link from "next/link";

import type {
  ArticleRelationship,
  LinkingSuggestions,
  ProductRelationship,
  RelationshipStrength,
} from "@/lib/contentops/intelligence/relationships";

type EditorialConnectionsProps = {
  suggestions: LinkingSuggestions;
  /** Max items shown per section. Default 4 — enough to be useful, calm enough to scan. */
  limit?: number;
};

const STRENGTH_LABEL: Record<RelationshipStrength, string> = {
  strong: "Strong",
  medium: "Medium",
  light: "Light",
};

const STRENGTH_TONE: Record<RelationshipStrength, string> = {
  strong: "bg-[#D7ECDD] text-[#1E5A37]",
  medium: "bg-[#D7E4EE] text-[#1E3F5A]",
  light: "bg-[#EFE7DE] text-[#3B2F2F]/72",
};

function StrengthPill({ strength }: { strength: RelationshipStrength }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${STRENGTH_TONE[strength]}`}
    >
      {STRENGTH_LABEL[strength]}
    </span>
  );
}

function ArticleRow({ relationship }: { relationship: ArticleRelationship }) {
  return (
    <li className="border-l-2 border-[#3B2F2F]/12 pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/blog/${relationship.article.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium leading-snug text-[#1F1918] underline-offset-2 hover:underline"
        >
          {relationship.article.title}
        </Link>
        <StrengthPill strength={relationship.strength} />
      </div>
      <p className="mt-1 text-xs text-[#3B2F2F]/72">{relationship.reason}</p>
    </li>
  );
}

function ProductRow({ relationship }: { relationship: ProductRelationship }) {
  return (
    <li className="border-l-2 border-[#3B2F2F]/12 pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/shop/${relationship.product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium leading-snug text-[#1F1918] underline-offset-2 hover:underline"
        >
          {relationship.product.name}
        </Link>
        <StrengthPill strength={relationship.strength} />
      </div>
      <p className="mt-1 text-xs text-[#3B2F2F]/72">
        {relationship.reason} ·{" "}
        <span className="text-[#3B2F2F]/55">{relationship.product.category}</span>
      </p>
    </li>
  );
}

export function EditorialConnections({
  suggestions,
  limit = 4,
}: EditorialConnectionsProps) {
  const articles = suggestions.relatedArticles.slice(0, limit);
  const products = suggestions.relatedProducts.slice(0, limit);

  if (articles.length === 0 && products.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Editorial connections
        </p>
        <p className="mt-1 text-sm text-[#3B2F2F]/72">
          Ideas for natural links and product pairings. Nothing is inserted
          automatically — use these as cues when refining the article.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {articles.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Related articles
            </p>
            <ul className="mt-3 space-y-4">
              {articles.map((rel) => (
                <ArticleRow key={rel.article.slug} relationship={rel} />
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Related articles
            </p>
            <p className="mt-3 text-sm text-[#3B2F2F]/55">
              No closely related articles yet.
            </p>
          </div>
        )}

        {products.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Related products
            </p>
            <ul className="mt-3 space-y-4">
              {products.map((rel) => (
                <ProductRow key={rel.product.slug} relationship={rel} />
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Related products
            </p>
            <p className="mt-3 text-sm text-[#3B2F2F]/55">
              No closely related products in the catalog.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
