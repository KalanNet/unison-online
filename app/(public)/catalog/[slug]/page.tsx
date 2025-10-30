// app/(public)/catalog/[slug]/page.tsx
import type { Metadata } from "next";
export const runtime = "edge";
export const dynamic = "force-dynamic";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";

/* ---------- helpers ---------- */
type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  bookmarks?: Array<{ id: string; page: number; label: string; color?: string | null }>;
  file?: string;
};

async function tryFetch(url: string) {
  try {
    const r = await fetch(url, { next: { revalidate: 0 } });
    if (!r.ok) return null;
    return (await r.json()) as MetaPayload;
  } catch {
    return null;
  }
}

/** Спроба розв’язати slug у кілька шаблонів шляхів */
async function resolveBySlug(slug: string): Promise<{ payload: MetaPayload | null; source: string | null }> {
  const candidates = [
    // 1) /catalog/<slug>/meta.json
    `${R2_PUBLIC_URL}/catalog/${slug}/meta.json`,
    // 2) /<slug>/meta.json
    `${R2_PUBLIC_URL}/${slug}/meta.json`,
    // 3) /<slug>.meta.json (кейс, коли meta лежить поряд із PDF на корені)
    `${R2_PUBLIC_URL}/${slug}.meta.json`,
  ];

  for (const url of candidates) {
    const payload = await tryFetch(url);
    if (payload?.file) return { payload, source: url };
  }
  return { payload: null, source: null };
}

/* ---------- generateMetadata ---------- */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const slug = params.slug;
  // спробувати отримати meta.json
  const { payload } = await resolveBySlug(slug);

  const title =
    payload?.meta?.title ||
    (typeof searchParams["title"] === "string" ? (searchParams["title"] as string) : undefined) ||
    `Catalog — ${slug}`;

  const description =
    payload?.meta?.description ||
    "Unison Alberta directory viewer.";

  const openGraphImages: string[] = [];
  if (payload?.meta?.featuredUrl) openGraphImages.push(payload.meta.featuredUrl);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: openGraphImages.length ? openGraphImages.map((u) => ({ url: u })) : undefined,
    },
  };
}

/* ---------- Page ---------- */
export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const slug = params.slug;

  // 1) спроба знайти meta.json за slug
  const { payload } = await resolveBySlug(slug);

  // 2) якщо meta.json не знайдено — дозволяємо ручний ?file=
  const fallbackFile = typeof searchParams["file"] === "string" ? (searchParams["file"] as string) : "";
  const file = payload?.file || fallbackFile;

  if (!file) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Not found</h2>
        <p>No meta.json found for slug “{slug}”. You can still pass <code>?file=&lt;pdf-url&gt;</code>.</p>
      </div>
    );
  }

  const title = payload?.meta?.title || (typeof searchParams["title"] === "string" ? (searchParams["title"] as string) : undefined) || slug;

  // Імпортуємо клієнтський в’ювер лише тут (уникаємо SSR помилок)
  const PublicViewer = (await import("@/app/public/PublicViewer")).default;

  // ВАЖЛИВО: не передаємо metaFromJson / bookmarksFromJson, щоб не ламати існуючий компонент
  return <PublicViewer file={file} title={title} />;
}
