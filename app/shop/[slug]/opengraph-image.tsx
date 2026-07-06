import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getProductBySlug, products } from "@/lib/products";

export const alt = "Little Smiles — premium baby essentials, Pakistan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Prebuild a card for every product so shared links resolve instantly. */
export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

const CREAM_BG =
  "linear-gradient(165deg, #F9F5F1 0%, #E8DDD4 42%, #EFE7DF 100%)";

/**
 * Per-product social preview (1200×630). Composes the product shot onto the
 * brand cream card with its name — so links shared on WhatsApp (our primary
 * channel) render a branded, product-specific preview. Falls back to a clean
 * branded card if the product or its image can't be resolved. Presentation
 * only; no product/order data is mutated.
 */
export default async function ProductOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  let imageDataUri: string | null = null;
  if (product) {
    try {
      const buffer = await readFile(join(process.cwd(), "public", product.image));
      imageDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
    } catch {
      imageDataUri = null;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          background: CREAM_BG,
          padding: 64,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        {imageDataUri ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 468,
              height: 502,
              borderRadius: 40,
              background: "#FFFFFF",
              border: "1px solid rgba(59,47,47,0.10)",
              boxShadow: "0 40px 80px -48px rgba(59,47,47,0.45)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUri}
              alt=""
              width={392}
              height={392}
              style={{ objectFit: "contain" }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            paddingLeft: imageDataUri ? 56 : 0,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#B08641",
            }}
          >
            Little Smiles
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: product && product.name.length > 22 ? 60 : 72,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#2A211C",
            }}
          >
            {product ? product.name : "Premium baby essentials"}
          </div>
          {product ? (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 30,
                fontWeight: 500,
                color: "#5C5050",
              }}
            >
              {product.category} · Pakistan
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 40,
              padding: "14px 28px",
              borderRadius: 999,
              background: "#B08641",
              color: "#332107",
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            Order on WhatsApp · Nationwide delivery
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
