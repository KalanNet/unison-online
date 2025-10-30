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
  file?: string;
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

/** ЄДИНИЙ шлях: /directory/<slug>/meta.json */
async function resolveBySlug(slug: string): Promise<MetaPayload | null> {
  const url = `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`;
  return await fetchJson<MetaPayload>(url);
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

  const title =
    data?.meta?.title ??
    (typeof searchParams.title === "string" ? (searchParams.title as string) : `Directory — ${params.slug}`);

  const description = data?.meta?.description ?? "Unison Alberta directory viewer.";
  const ogImg = data?.meta?.featuredUrl ?? "https://unison-online-dev.pages.dev/og.jpg";

  return {
    title,
    description,
    openGraph: { title, description, images: [ogImg] },
    twitter: { card: "summary_large_image", title, description, images: [ogImg] },
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

  // Фолбек: дозволяємо ?file=<pdf-url>, якщо meta.json відсутній
  if (!data && typeof searchParams.file === "string" && searchParams.file) {
    const PublicViewer = (await import("app/public/PublicViewer")).default; // повний шлях
    return <PublicViewer file={searchParams.file} title="Preview" />;
  }

  if (!data?.file) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Not found</h2>
        <p>
          Expected meta at{" "}
          <code>{`${R2_PUBLIC}/directory/${params.slug}/meta.json`}</code>
        </p>
      </div>
    );
  }

  const PublicViewer = (await import("app/public/PublicViewer")).default; // повний шлях
  const title = data.meta?.title || params.slug;

  return <PublicViewer file={data.file} title={title} />;
}
