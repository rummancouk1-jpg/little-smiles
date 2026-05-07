import { ImageResponse } from "next/og";

export const alt =
  "Little Smiles — premium baby essentials, Pakistan-wide delivery, WhatsApp ordering";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

/** Default branded social preview (1200×630). Product URLs override via metadata images. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(165deg, #F9F5F1 0%, #E8DDD4 42%, #EFE7DF 100%)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 76,
            fontWeight: 600,
            color: "#2E2323",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          Little Smiles
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            fontWeight: 500,
            color: "#3B2F2F",
            opacity: 0.92,
          }}
        >
          Premium baby essentials · Pakistan
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 22,
            color: "#5C5050",
            letterSpacing: "0.02em",
          }}
        >
          Order on WhatsApp · Nationwide delivery
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
