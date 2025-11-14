// app/(public)/directory/[slug]/page.tsx
import type { Metadata } from "next";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- Types ---------- */
type Bookmark = { id: string; page: number; label: string; color: string | null };

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[];
};

/* ---------- Constants ---------- */

// Та сама featured-картинка, що й на головній (лежить у public/og-featured-home.jpg)
const DEFAULT_OG_IMAGE = "/og-featured-home.jpg";

// Meta для соцмереж саме для 2025 каталогу
const SOCIAL_TITLE_2025 = "Services and Housing Directory 2025";
const SOCIAL_DESC_2025 =
  "A helpful resource for seniors in Calgary to find Services and Housing all gathered in Directory Catalogue.";

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
  // structuredClone fallback: JSON roundtrip (plain-об’єкт)
  return JSON.parse(JSON.stringify(out));
}

/* ---------- Metadata ---------- */
export async function generateMetadata({
  params,
}: {
  params: { slug: string | string[] };
}): Promise<Metadata> {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const data = slug ? await getMeta(slug) : null;

  const is2025 = slug === "services-and-housing-directory-2025";

  const title =
    data?.meta?.title ??
    (is2025 ? SOCIAL_TITLE_2025 : `Directory — ${slug ?? ""}`);

  const description =
    data?.meta?.description ??
    (is2025 ? SOCIAL_DESC_2025 : "Unison Alberta directory viewer.");

  // 1) Якщо у meta.json є featuredUrl – беремо його.
  // 2) Якщо ні – падаємо назад на ту ж featured, що й на головній.
  const ogImg = data?.meta?.featuredUrl || DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImg],
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

  // SSR-спроба отримати meta.json через внутрішній API
  const data = slug ? await getMeta(slug) : null;

  // Фолбек: якщо meta немає — дозволяємо прямий перегляд через ?file=
  if (!data?.file) {
    if (typeof searchParams.file === "string" && searchParams.file) {
      const PublicViewer = (await import("app/public/PublicViewer")).default;
      const safeBookmarks = sanitizeBookmarks(data?.bookmarks);
      const title = data?.meta?.title || slug || "Preview";
      return (
        <PublicViewer file={searchParams.file} title={title} bookmarks={safeBookmarks} />
      );
    }
    // Клієнтський "слухач" підтягне slug із URL та спробує ще раз
    const ClientFallback = (await import("app/(public)/directory/[slug]/ClientFallback"))
      .default;
    return <ClientFallback />;
  }

  // Основний рендер публічного в’ювера
  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const title = data.meta?.title ?? slug;
  const safeBookmarks = sanitizeBookmarks(data.bookmarks);

  return <PublicViewer file={data.file} title={title} bookmarks={safeBookmarks} />;
}
