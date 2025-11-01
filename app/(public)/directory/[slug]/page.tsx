// app/(public)/directory/[slug]/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";

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
    const r = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** ЄДИНИЙ шлях: /directory/<slug>/meta.json  */
async function resolveBySlug(slug: string): Promise<MetaPayload | null> {
  const url = `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`;
  return await fetchJson<MetaPayload>(url);
}

/** Аккуратно дістаємо slug, навіть якщо Next не поклав його в params */
/** Акуратно дістаємо slug, навіть якщо Next не поклав його в params */
function getSafeSlug(params: any): string | null {
  const p = params?.slug;
  if (typeof p === "string" && p) return p;
  if (Array.isArray(p) && p[0]) return p[0];

  // запасний варіант: пробуємо витягнути зі шляхів у заголовках, але без await
  try {
    const maybe: any = (headers as any)();           // може бути ReadonlyHeaders або Promise
    const h: any =
      maybe && typeof maybe.get === "function"       // якщо це вже заголовки
        ? maybe
        : undefined;                                  // якщо Promise — пропускаємо, без await

    if (h) {
      const raw =
        h.get("x-original-url") ||
        h.get("x-invoke-path") ||
        h.get("referer") ||
        "";
      const m = String(raw).match(/\/directory\/([^/?#]+)/i);
      if (m?.[1]) return decodeURIComponent(m[1]);
    }
  } catch {
    /* no-op */
  }
  return null;
}


/* ---------- metadata ---------- */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug?: string | string[] };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const slug = getSafeSlug(params);
  const data = slug ? await resolveBySlug(slug) : null;

  const title =
    data?.meta?.title ??
    (typeof searchParams.title === "string" ? (searchParams.title as string) : `Directory — ${slug ?? "…"}`);

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
  params: { slug?: string | string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const slug = getSafeSlug(params);

  // Фолбек: ?file=<pdf-url>, якщо meta.json немає
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
