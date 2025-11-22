// app/(public)/directory/[slug]/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ---------- Types ---------- */
type Bookmark = { id: string; page: number; label: string; color: string | null };

type AdSlot = {
  id: string;
  imageUrl: string;
  href?: string | null;
  label?: string | null;
  seq?: number | null;
};

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[];
  ads?: AdSlot[];
};

/* ---------- Constants ---------- */
const DEFAULT_OG_IMAGE = "/og-featured-home.jpg";
const SOCIAL_TITLE_2025 = "Services and Housing Directory 2025";
const SOCIAL_DESC_2025 =
  "A helpful resource for seniors in Calgary to find Services and Housing all gathered in Directory Catalogue.";

/* ---------- Helpers ---------- */
async function absUrl(path: string): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${proto}://${host}${p}`;
}

async function getMeta(slug: string): Promise<MetaPayload | null> {
  try {
    const url = await absUrl(`/api/directory/${encodeURIComponent(slug)}`);
    const r = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    if (!r.ok) return null;
    return (await r.json()) as MetaPayload;
  } catch {
    return null;
  }
}

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
    const color = typeof colorRaw === "string" && colorRaw.trim() ? colorRaw : null;
    if (label.length > 0) out.push({ id, page, label, color });
  }
  return JSON.parse(JSON.stringify(out));
}

/** Санітаризація рекламних слотів (гнучко читаємо джерело картинки) */
function sanitizeAds(input: unknown): AdSlot[] {
  if (!Array.isArray(input)) return [];
  const out: AdSlot[] = [];

  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const anyIt = it as Record<string, unknown>;

    // 👇 підтримуємо різні назви полів від бекенду
    const rawImg =
      (anyIt.imageUrl as unknown) ??
      (anyIt.url as unknown) ??
      (anyIt.image as unknown) ??
      (anyIt.img as unknown);

    const imageUrl = String(rawImg ?? "").trim();
    if (!imageUrl) continue; // без картинки — пропускаємо

    const id =
      String(
        (anyIt.id as unknown) ??
          // запасний варіант, щоб key був стабільним
          `${(anyIt.label as string | undefined) || "ad"}-${imageUrl}`
      );

    const hrefVal =
      anyIt.href == null ? null : (String(anyIt.href).trim() || null);
    const labelVal =
      anyIt.label == null ? null : (String(anyIt.label).trim() || null);

    const seqNum = Number(anyIt.seq);
    const seq = Number.isFinite(seqNum) ? (seqNum as number) : null;

    out.push({ id, imageUrl, href: hrefVal, label: labelVal, seq });
  }

  const sorted = out
    .sort((a, b) => (a.seq ?? 999) - (b.seq ?? 999))
    .slice(0, 5)
    .map((a, i) => ({ ...a, seq: a.seq ?? i }));

  return JSON.parse(JSON.stringify(sorted));
}

/* ---------- Metadata ---------- */
export async function generateMetadata({
  params,
}: {
  params: { slug: string | string[] };
}): Promise<Metadata> {
  const slugRaw = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const slug = slugRaw ?? "";
  const data = slug ? await getMeta(slug) : null;

  const title = data?.meta?.title ?? SOCIAL_TITLE_2025;
  const description = data?.meta?.description ?? SOCIAL_DESC_2025;
  const ogImg = data?.meta?.featuredUrl || DEFAULT_OG_IMAGE;

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
  const data = slug ? await getMeta(slug) : null;

  // Фолбек: якщо meta немає — дозволяємо прямий перегляд через ?file=
  if (!data?.file) {
    const fileParam = typeof searchParams.file === "string" ? searchParams.file : "";
    if (fileParam) {
      const PublicViewer = (await import("app/public/PublicViewer")).default;
      const title = data?.meta?.title || slug || "Preview";
      return (
        <PublicViewer
          file={fileParam}
          title={title}
          bookmarks={sanitizeBookmarks(data?.bookmarks)}
          ads={sanitizeAds((data as any)?.ads)}
        />
      );
    }
    const ClientFallback =
      (await import("app/(public)/directory/[slug]/ClientFallback")).default;
    return <ClientFallback />;
  }

  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const title = data.meta?.title ?? slug;

  return (
    <PublicViewer
      file={data.file}
      title={title}
      bookmarks={sanitizeBookmarks(data.bookmarks)}
      ads={sanitizeAds(data.ads)}
    />
  );
}
