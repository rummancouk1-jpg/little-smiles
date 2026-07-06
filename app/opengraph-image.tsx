import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Little Smiles — premium baby essentials, Pakistan-wide delivery, WhatsApp ordering";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

/** Default branded social preview (1200×630) — the logo mark + wordmark on the
 *  brand cream ground. Product URLs override this via their own opengraph-image. */
export default async function OpenGraphImage() {
  let logoDataUri: string | null = null;
  try {
    const buffer = await readFile(join(process.cwd(), "app", "icon.png"));
    logoDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    logoDataUri = null;
  }

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
        {logoDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoDataUri}
            alt=""
            width={230}
            height={230}
            style={{ objectFit: "contain" }}
          />
        ) : null}
        <div
          style={{
            marginTop: 8,
            fontSize: 66,
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
            marginTop: 20,
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
            display: "flex",
            marginTop: 26,
            padding: "13px 26px",
            borderRadius: 999,
            background: "#B08641",
            color: "#332107",
            fontSize: 22,
            fontWeight: 600,
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
