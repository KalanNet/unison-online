// app/(public)/directory/[slug]/page.tsx
import type { Metadata } from "next";
import MetaHead from "app/(public)/directory/[slug]/MetaHead";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- Config ---------- */
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://unison-online-dev.pages.dev").replace(/\/$/, "");

/* ---------- Types ---------- */
type Bookmark = { id: string; page: number; label: string; color: string | null };
type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[];
};

/* ---------- Helpers ---------- */
const abs = (p: string) => (/^https?:\/\//i.test(p) ? p : `${SITE_ORIGIN}${p.startsWith("/") ? "" : "/"}${p}`);

async function getMeta(slug: string): Promise<MetaPayload | null> {
  try {
    // йдемо у власний API, щоб не впиратись у кеш CDN
    const r = await fetch(abs(`/api/directory/${encodeURIComponent(slug)}`), {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!r.ok) return null;
    return (await r.json()) as MetaPayload;
  } catch {
    return null;
  }
}

function sanitizeBookmarks(input: unknown): Bookmark[] {
  if (!Array.isArray(input)) return [];
  const out: Bookmark[] = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const anyIt = it as Record<string, unknown>;
    const id = String(anyIt.id ?? "");
    const pageNum = Number(anyIt.page);
    const page = Number.isFinite(pageNum) ? Math.max(1, pageNum) : 1;
    const label = String(anyIt.label ?? "");
    const colorRaw = anyIt.color;
    const color = typeof colorRaw === "string" && colorRaw.trim().length > 0 ? colorRaw : null;
    if (label.length > 0) out.push({ id, page, label, color });
  }
  return JSON.parse(JSON.stringify(out));
}

function pickOgImage(featuredUrl?: string | null) {
  const raw = (featuredUrl ?? "").trim();
  const isAbs = /^https?:\/\//i.test(raw);
  const isWebp = /\.webp(\?|#|$)/i.test(raw);
  // Телега/FB часом ігнорять webp → фолбек на /og.jpg
  return (!isAbs || isWebp || !raw) ? `${SITE_ORIGIN}/og.jpg` : raw;
}

/* ---------- Dynamic metadata per slug ---------- */
export async function generateMetadata(
  { params }: { params: { slug: string | string[] } }
): Promise<Metadata> {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug || "";
  const data = slug ? await getMeta(slug) : null;

  const title = (data?.meta?.title ?? `Directory — ${slug}`).trim();
  const description = (data?.meta?.description ?? "Unison Alberta directory viewer.").trim();
  const ogImg = pickOgImage(data?.meta?.featuredUrl);

  return {
    metadataBase: new URL(SITE_ORIGIN),
    alternates: { canonical: `/directory/${slug}` },
    title,
    description,
    openGraph: {
      type: "article",
      url: abs(`/directory/${slug}`),
      siteName: "Unison Alberta",
      title,
      description,
      images: [{ url: ogImg, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImg] },
  };
}

/* ---------- Page ---------- */
export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string | string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug || "";
  const data = slug ? await getMeta(slug) : null;

  // Значення для <head>
  const title = (data?.meta?.title ?? `Directory — ${slug}`).trim();
  const description = (data?.meta?.description ?? "Unison Alberta directory viewer.").trim();
  const url = abs(`/directory/${slug}`);
  const ogImg = pickOgImage(data?.meta?.featuredUrl);

  // Фолбек: прямий перегляд через ?file=
  if (!data?.file) {
    if (typeof searchParams.file === "string" && searchParams.file) {
      const PublicViewer = (await import("app/public/PublicViewer")).default;
      const safeBookmarks = sanitizeBookmarks(data?.bookmarks);
      return (
        <>
          <MetaHead title={title} description={description} url={url} ogImage={ogImg} />
          <PublicViewer file={searchParams.file} title={title} bookmarks={safeBookmarks} />
        </>
      );
    }
    const ClientFallback = (await import("app/(public)/directory/[slug]/ClientFallback")).default;
    return (
      <>
        <MetaHead title={title} description={description} url={url} ogImage={ogImg} />
        <ClientFallback />
      </>
    );
  }

  // Основний рендер
  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const safeBookmarks = sanitizeBookmarks(data.bookmarks);

  return (
    <>
      <MetaHead title={title} description={description} url={url} ogImage={ogImg} />
      <PublicViewer file={data.file} title={title} bookmarks={safeBookmarks} />
    </>
  );
}
