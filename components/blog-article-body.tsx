// Shared renderer for the article body. Used by both the public
// /blog/[slug] page and the operator ArticlePreview so visual fidelity
// is guaranteed without manual sync.
//
// Renders the article content inside the parent's card — the outer card
// itself stays at the call site, since the public page and the operator
// preview wrap this body slightly differently (the preview adds an
// "Article preview · this is what readers will see" eyebrow card; the
// public page uses a single card directly).
//
// Image philosophy (Commit P): content-first, image-supported. Hero sits
// after title/description/meta as a visual anchor before the sections.
// Section images close their section, never lead it. Both render at
// article width within the card padding — no full-bleed, no edge-to-edge.
// Captions are small, italic, centered below the image.

import Link from "next/link";

import { SafeImage } from "@/components/contentops/safe-image";
import type { BlogImage, BlogPost } from "@/lib/contentops/blog-schema";
import { resolveBlogImageSrc } from "@/lib/contentops/image-render";

type BlogArticleBodyProps = {
  post: BlogPost;
  /**
   * Heading level for the article title. 1 for public pages where the
   * article is the top of the document; 2 for nested contexts like the
   * operator preview. Section headings move accordingly (h2/h3).
   */
  titleLevel?: 1 | 2;
  /**
   * When true, the CTA renders as a real navigable Link. When false
   * (operator preview), the CTA renders as a styled span — same visual
   * weight, no accidental navigation.
   */
  ctaInteractive?: boolean;
};

function HeroFigure({ image }: { image: BlogImage }) {
  const resolved = resolveBlogImageSrc(image);
  return (
    <figure className="mt-8">
      <div className="overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
        <SafeImage
          src={resolved.src}
          alt={image.altText}
          width={image.width}
          height={image.height}
          sizes="(max-width: 768px) 100vw, 896px"
          className="h-auto w-full"
          priority
          {...(resolved.blurDataURL
            ? { placeholder: "blur" as const, blurDataURL: resolved.blurDataURL }
            : {})}
        />
      </div>
      {image.caption ? (
        <figcaption className="mt-2 text-center text-xs italic text-[#3B2F2F]/55">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function SectionFigure({ image }: { image: BlogImage }) {
  const resolved = resolveBlogImageSrc(image);
  return (
    <figure className="mt-4">
      <div className="overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
        <SafeImage
          src={resolved.src}
          alt={image.altText}
          width={image.width}
          height={image.height}
          sizes="(max-width: 768px) 100vw, 896px"
          className="h-auto w-full"
          {...(resolved.blurDataURL
            ? { placeholder: "blur" as const, blurDataURL: resolved.blurDataURL }
            : {})}
        />
      </div>
      {image.caption ? (
        <figcaption className="mt-2 text-center text-xs italic text-[#3B2F2F]/55">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function BlogArticleBody({
  post,
  titleLevel = 1,
  ctaInteractive = true,
}: BlogArticleBodyProps) {
  const Title = titleLevel === 2 ? "h2" : "h1";
  const SectionHeading = titleLevel === 2 ? "h3" : "h2";
  const titleClass =
    titleLevel === 2
      ? "mt-4 text-balance text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl"
      : "mt-4 text-balance text-4xl font-semibold tracking-tight text-[#1F1918] sm:text-5xl";
  const publishedIso = `${post.publishedAt}T12:00:00+05:00`;

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/52">
        {post.category}
      </p>
      <Title className={titleClass}>{post.title}</Title>
      <p className="mt-5 text-base leading-relaxed text-[#3B2F2F]/72 sm:text-lg">
        {post.description}
      </p>
      <p className="mt-4 text-xs text-[#3B2F2F]/58">
        <time dateTime={publishedIso}>
          {post.publishedAt} · {post.readTime}
        </time>
      </p>

      {post.hero ? <HeroFigure image={post.hero} /> : null}

      <div className="mt-9 space-y-8">
        {post.sections.map((section, idx) => (
          <section key={`${section.heading}-${idx}`}>
            <SectionHeading className="text-2xl font-semibold tracking-tight text-[#241B1B]">
              {section.heading}
            </SectionHeading>
            <div className="mt-3 space-y-3 text-base leading-relaxed text-[#3B2F2F]/74">
              {section.content.map((paragraph, pIdx) => (
                <p key={pIdx}>{paragraph}</p>
              ))}
            </div>
            {section.image ? <SectionFigure image={section.image} /> : null}
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-[#3B2F2F]/10 bg-[#F8F2EC] p-5">
        <p className="text-sm text-[#3B2F2F]/72">
          Ready to shop products mentioned in this guide?
        </p>
        {ctaInteractive ? (
          <Link
            href={post.cta.href}
            className="mt-3 inline-flex rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-colors hover:bg-[#251E1D]"
          >
            {post.cta.label}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="mt-3 inline-flex cursor-default rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC]"
          >
            {post.cta.label}
          </span>
        )}
        {!ctaInteractive ? (
          <p className="mt-2 text-xs text-[#3B2F2F]/52">
            Links to <span className="font-mono">{post.cta.href}</span>
          </p>
        ) : null}
      </div>
    </>
  );
}
