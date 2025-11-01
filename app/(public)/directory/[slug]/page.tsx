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
  file?: string;               // PDF public URL
  publishedAt?: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** ЄДИНИЙ шлях: /directory/<slug>/meta.json */
async function resolveBySlug(slug: string): Promise<MetaPayload | null> {
  const url = `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`;
  return await fetchJson<MetaPayload>(url);
}

/* ---------- generateMetadata ---------- */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string | string[] };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const data = slug ? await resolveBySlug(slug) : null;

  const title =
    data?.meta?.title ??
    (typeof searchParams.title === "string" ? (searchParams.title as string) : `Directory — ${slug ?? ""}`);

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
export default async function DirectoryPublicPage({
  params,
  searchParams,
}: {
  params: { slug: string | string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  // Фолбек: дозволяємо ?file=<pdf-url>, якщо meta.json відсутній
  if (!slug) {
    if (typeof searchParams.file === "string" && searchParams.file) {
      const PublicViewer = (await import("app/public/PublicViewer")).default;
      return <PublicViewer file={searchParams.file} title="Preview" />;
    }
    return (
      <div style={{ padding: 24 }}>
        <h2>Not found</h2>
        <p>Missing slug in /directory/[slug].</p>
      </div>
    );
  }

  const data = await resolveBySlug(slug);

  if (!data?.file) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Not found</h2>
        <p>
          Expected meta at{" "}
          <code>{`${R2_PUBLIC}/directory/${slug}/meta.json`}</code>
        </p>
      </div>
    );
  }

  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const title = data.meta?.title || slug;
  return <PublicViewer file={data.file} title={title} />;
}
