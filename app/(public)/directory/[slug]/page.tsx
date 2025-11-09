// app/(public)/directory/[slug]/page.tsx
import { headers as nextHeaders } from "next/headers";
import type { Metadata } from "next";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- Config ---------- */
const R2_PUBLIC =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";

/* ---------- Types ---------- */
type Bookmark = { id: string; page: number; label: string; color: string | null };

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[];
};

/* ---------- Helpers ---------- */
/** Читаємо meta.json БЕЗПОСЕРЕДНЬО з CDN (а не через /api/...) */
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

/** Жорстка санітаризація + клон для безпечної серіалізації між SSR/CSR */
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

/* ---------- Metadata ---------- */
export async function generateMetadata({
  params,
}: {
  params: { slug: string | string[] };
}): Promise<Metadata> {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  // Абсолютний origin для canonical/OG (важливо для соцмереж)
  const h = await nextHeaders(); // <= головне виправлення
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL; // якщо маєш – ще надійніше
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin =
    envOrigin && /^https?:\/\//i.test(envOrigin)
      ? envOrigin
      : host
      ? `${proto}://${host}`
      : "https://unison-online-dev.pages.dev";

  const data = slug ? await getMeta(slug) : null;

  const title = data?.meta?.title ?? `Directory — ${slug ?? ""}`;
  const description = data?.meta?.description ?? "Unison Alberta directory viewer.";

  const candidate = data?.meta?.featuredUrl ?? "";
  const ogImg = /^https?:\/\//i.test(candidate) ? candidate : `${origin}/og.jpg`;

  return {
    metadataBase: new URL(origin),
    alternates: { canonical: `/directory/${slug}` },

    title,
    description,

    openGraph: {
      type: "article",
      url: `/directory/${slug}`,
      siteName: "Unison Alberta",
      title,
      description,
      images: [{ url: ogImg, width: 1200, height: 630, alt: title }],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImg],
    },
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
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  // SSR-спроба отримати meta.json (через CDN)
  const data = slug ? await getMeta(slug) : null;

  // Фолбек: якщо meta/file немає — дозволяємо прямий перегляд через ?file=
  if (!data?.file) {
    if (typeof searchParams.file === "string" && searchParams.file) {
      const PublicViewer = (await import("app/public/PublicViewer")).default;
      const safeBookmarks = sanitizeBookmarks(data?.bookmarks);
      const title = data?.meta?.title || slug || "Preview";
      return <PublicViewer file={searchParams.file} title={title} bookmarks={safeBookmarks} />;
    }
    const ClientFallback = (await import("app/(public)/directory/[slug]/ClientFallback")).default;
    return <ClientFallback />;
  }

  // Основний рендер публічного в’ювера
  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const title = data.meta?.title ?? slug;
  const safeBookmarks = sanitizeBookmarks(data.bookmarks);

  return <PublicViewer file={data.file} title={title} bookmarks={safeBookmarks} />;
}
