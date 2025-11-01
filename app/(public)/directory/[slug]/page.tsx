// app/(public)/directory/[slug]/page.tsx
import type { Metadata } from "next";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- Types ---------- */
type Bookmark = { id: string; page: number; label: string; color?: string | null };

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[]; // ← важливо: закладки в payload
};

/* ---------- Helpers ---------- */
async function getMeta(slug: string): Promise<MetaPayload | null> {
  // Відносний виклик внутрішнього API (Edge/Pages friendly)
  const r = await fetch(`/api/directory/${encodeURIComponent(slug)}`, {
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
    const ClientFallback = (await import("app/(public)/directory/[slug]/ClientFallback")).default;
    return <ClientFallback />;
  }

  // ---- Є ФАЙЛ. Готуємо закладки до безпечної серіалізації ----
  // 1) Гарантуємо масив
  const raw = Array.isArray(data.bookmarks) ? data.bookmarks : [];
  // 2) Перетворюємо типи, прибираємо null/undefined, щоб Next не «обрізав» ключі під час передачі в клієнт
  const normalized = raw.map((b, i) => ({
    id: String(b?.id ?? `bm-${i}`),
    page: Number((b as any)?.page ?? 1),
    label: String((b as any)?.label ?? ""),
    color: (b as any)?.color ?? null,
  }));
  // 3) Жорстка JSON-серіалізація (обхід edge-глюків із несеріаліз. значеннями)
  const safeBookmarks: Bookmark[] = JSON.parse(JSON.stringify(normalized));

  // Основний рендер публічного в’ювера
  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const title = data.meta?.title ?? slug;

  return (
    <PublicViewer
      file={data.file}
      title={title}
      bookmarks={safeBookmarks}
    />
  );
}
