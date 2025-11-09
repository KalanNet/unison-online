/* App Router metadata file convention:
   Builds a 1200x630 OG image per slug, using meta.json title as text.
   Next.js will expose it at /directory/<slug>/opengraph-image
*/
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const R2_PUBLIC = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";

type MetaPayload = {
  meta?: { title?: string; featuredUrl?: string | null };
};

async function getMeta(slug: string): Promise<MetaPayload | null> {
  try {
    const r = await fetch(
      `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`,
      { cache: "no-store", next: { revalidate: 0 } }
    );
    if (!r.ok) return null;
    return (await r.json()) as MetaPayload;
  } catch {
    return null;
  }
}

export default async function OG({ params }: { params: { slug: string | string[] } }) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug || "";
  const data = slug ? await getMeta(slug) : null;
  const title = (data?.meta?.title || `Directory — ${slug}`).trim();

  // Мінімалістичний брендований фон + текст (стабільно для скраперів).
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: 64,
          background: "#21353a",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 128,
            height: 128,
            borderRadius: 24,
            background:
              "linear-gradient(135deg,#E6533E 0%,#F89828 30%,#1DBBB4 60%,#135D66 100%)",
            marginBottom: 24,
          }}
        />
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            color: "white",
            lineHeight: 1.1,
            textShadow: "0 2px 12px rgba(0,0,0,.35)",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 28,
            color: "rgba(255,255,255,.85)",
          }}
        >
          Unison Alberta
        </div>
      </div>
    ),
    { ...size }
  );
}
