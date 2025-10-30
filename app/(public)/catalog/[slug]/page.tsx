// app/(public)/catalog/[slug]/page.tsx
import type { Metadata } from "next";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const R2_PUBLIC = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";
const R2_ALIAS   = `${R2_PUBLIC}/_catalog/slug`;

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

/** 1) повний дубль → 2) аліас-покажчик → 3) “класичні” шляхи навколо PDF */
async function resolveBySlug(slug: string): Promise<MetaPayload | null> {
  // ① full-мета, яку ми теж пишемо в /api/publish
  const full = await fetchJson<MetaPayload>(`${R2_ALIAS}/${slug}.full.json`);
  if (full?.file) return full;

  // ② легкий аліас → { href } → справжній meta.json
  const alias = await fetchJson<{ href?: string }>(`${R2_ALIAS}/${slug}.json`);
  if (alias?.href) {
    const meta = await fetchJson<MetaPayload>(alias.href);
    if (meta?.file) return meta;
  }

  // ③ резервні варіанти як у попередній версії
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
    (typeof searchParams.title === "string" ? (searchParams.title as string) : `Catalog — ${params.slug}`);

  const description = data?.meta?.description || "Unison Alberta directory viewer.";
  const ogImg = data?.meta?.featuredUrl || "https://unison-online-dev.pages.dev/og.jpg";

  return {
    title: titleBase,
    description,
    openGraph: { title: titleBase, description, images: [ogImg] },
    twitter: { card: "summary_large_image", title: titleBase, description, images: [ogImg] },
  };
}

/* ---------- page ---------- */
export default async function CatalogPublicPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await resolveBySlug(params.slug);

  // фолбек: дозволяємо ?file=<pdf-url> навіть без meta.json
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

  // ВАЖЛИВО: передаємо лише підтримувані пропси
  return <PublicViewer file={data.file} title={title} />;
}
