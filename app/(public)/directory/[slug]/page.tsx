// app/(public)/directory/[slug]/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- Types ---------- */
type Bookmark = { id: string; page: number; label: string; color?: string | null };

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[]; // ← важливо: додаємо закладки у payload
};

/* ---------- Helpers ---------- */
async function getMeta(slug: string): Promise<MetaPayload | null> {
  // ВАЖЛИВО: абсолютний URL (Edge/Pages safe)
  const h = await headers(); // ← виправлення: headers() повертає Promise
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return null;

  const base = `${proto}://${host}`;
  const r = await fetch(`${base}/api/directory/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!r.ok) return null;
  return (await r.json()) as MetaPayload;
}

/* ---------- Metadata ---------- */
export async function generateMetadata({
  params,
}: {
  params: { slug: string | string[] };
}): Promise<Metadata> {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const data = slug ? await getMeta(slug) : null;

  const title = data?.meta?.title ?? `Directory — ${slug ?? ""}`;
  const description = data?.meta?.description ?? "Unison Alberta directory viewer.";
  const ogImg = data?.meta?.featuredUrl ?? "https://unison-online-dev.pages.dev/og.jpg";

  return {
    title,
    description,
    openGraph: { title, description, images: [ogImg] },
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
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  // SSR-спроба отримати meta.json через внутрішній API
  const data = slug ? await getMeta(slug) : null;

  // Фолбек: якщо meta немає — дозволяємо прямий перегляд через ?file=
  if (!data?.file) {
    if (typeof searchParams.file === "string" && searchParams.file) {
      const PublicViewer = (await import("app/public/PublicViewer")).default;
      return <PublicViewer file={searchParams.file} title="Preview" />;
    }
    // Клієнтський "слухач" підтягне slug із URL та спробує ще раз
    const ClientFallback = (await import("app/(public)/directory/[slug]/ClientFallback")).default;
    return <ClientFallback />;
  }

  // Основний рендер публічного в’ювера
  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const title = data.meta?.title ?? slug;

  return (
    <PublicViewer
      file={data.file}
      title={title}
      bookmarks={Array.isArray(data.bookmarks) ? data.bookmarks : []}
    />
  );
}
