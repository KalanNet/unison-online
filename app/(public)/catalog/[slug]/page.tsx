// app/(public)/directory/[slug]/page.tsx
import type { Metadata } from "next";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const R2_PUBLIC =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";

type Bookmark = { id: string; page: number; label: string; color?: string | null };
type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  bookmarks?: Bookmark[];
  file?: string;                 // PDF public URL
  publishedAt?: string;
};

async function fetchJson<T = unknown>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Основна розв'язка slug -> meta.json
 * 1) /directory/<slug>/meta.json (новий стандарт)
 * 2) легасі-фолбеки на випадок старих публікацій
 */
async function resolveBySlug(slug: string): Promise<MetaPayload | null> {
  // ① новий стандарт
  const primary = await fetchJson<MetaPayload>(
    `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`
  );
  if (primary?.file) return primary;

  // ② легасі-фолбеки (залишаємо на випадок старих завантажень)
  const candidates = [
    `${R2_PUBLIC}/catalog/${slug}/meta.json`,
    `${R2_PUBLIC}/${slug}/meta.json`,
    `${R2_PUBLIC}/${slug}.meta.json`,
  ];
  for (const url of candidates) {
    const payload = await fetchJson<MetaPayload>(url);
    if (payload?.file) return payload;
  }

  return null;
}

/* ---------- metadata ---------- */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const data = await resolveBySlug(params.slug);

  const titleBase =
    data?.meta?.title ||
    (typeof searchParams.title === "string"
      ? (searchParams.title as string)
      : `Directory — ${params.slug}`);

  const description = data?.meta?.description || "Unison Alberta directory viewer.";
  const ogImg =
    data?.meta?.featuredUrl || "https://unison-online-dev.pages.dev/og.jpg";

  return {
    title: titleBase,
    description,
    openGraph: { title: titleBase, description, images: [ogImg] },
    twitter: { card: "summary_large_image", title: titleBase, description, images: [ogImg] },
  };
}

/* ---------- page ---------- */
export default async function DirectoryPublicPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await resolveBySlug(params.slug);

  // Фолбек: ?file=<pdf-url> дозволений навіть без meta.json
  if (!data && typeof searchParams.file === "string" && searchParams.file) {
    const PublicViewer = (await import("app/public/PublicViewer")).default;
    return <PublicViewer file={searchParams.file} title="Preview" />;
  }

  if (!data?.file) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Not found</h2>
        <p>
          No meta.json found for slug “{params.slug}”. You can still pass{" "}
          <code>?file=&lt;pdf-url&gt;</code>.
        </p>
      </div>
    );
  }

  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const title = data.meta?.title || params.slug;
  return <PublicViewer file={data.file} title={title} />;
}
