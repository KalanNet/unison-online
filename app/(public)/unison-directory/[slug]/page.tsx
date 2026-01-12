import type { Metadata } from "next";
import { headers } from "next/headers";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/* ───── Types ───── */
type Bookmark = { id: string; page: number; label: string; color: string | null };
type AdSlot = { id: string; imageUrl: string; href?: string | null; label?: string | null; seq?: number | null };
type TocItem = { id: string; label: string; page: number; isSection?: boolean };

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: unknown;
  ads?: unknown;
  content?: unknown;
  toc?: unknown;
  tableOfContents?: unknown;
};

const DEFAULT_OG_IMAGE = "/og-featured-home.jpg";
const SOCIAL_TITLE_2025 = "Services and Housing Directory 2026";
const SOCIAL_DESC_2025 =
  "A helpful resource for seniors in Calgary to find Services and Housing all gathered in Directory Catalogue.";

const PDF_URL_RE = /^https?:\/\/.+\.pdf(\?.*)?$/i;

/* ───── Helpers ───── */
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

/* ───── Sanitizers ───── */
function sanitizeBookmarks(input: unknown): Bookmark[] {
  if (!Array.isArray(input)) return [];
  const out: Bookmark[] = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const id = String(o.id ?? "");
    const n = Number(o.page);
    const page = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
    const label = String(o.label ?? "").trim();
    const colorVal = typeof o.color === "string" && o.color.trim() ? o.color : null;
    if (!label) continue;
    out.push({ id, page, label, color: colorVal });
  }
  return JSON.parse(JSON.stringify(out));
}

function sanitizeAds(input: unknown): AdSlot[] {
  if (!Array.isArray(input)) return [];
  const out: AdSlot[] = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const imageUrl = String((o.imageUrl ?? o.url ?? o.image ?? o.img) ?? "").trim();
    if (!imageUrl) continue;
    const id = String(o.id ?? `${o.label ?? "ad"}-${imageUrl}`);
    const href = o.href == null ? null : String(o.href).trim() || null;
    const label = o.label == null ? null : String(o.label).trim() || null;
    const seqN = Number(o.seq);
    const seq = Number.isFinite(seqN) ? seqN : null;
    out.push({ id, imageUrl, href, label, seq });
  }
  return out
    .sort((a, b) => (a.seq ?? 999) - (b.seq ?? 999))
    .slice(0, 5)
    .map((a, i) => ({ ...a, seq: a.seq ?? i }));
}

function sanitizeContent(input: unknown): TocItem[] {
  if (!Array.isArray(input)) return [];
  const out: TocItem[] = [];

  const normPage = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : Number.POSITIVE_INFINITY;
  };

  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const label = String((o.label ?? o.title ?? o.name) ?? "").trim();
    if (!label) continue;

    const pageN = normPage(o.page ?? o.p ?? o.pageNumber);
    const isSection = Boolean(o.isSection ?? o.section ?? o.isHeader ?? (o.type === "section"));
    const id = String(o.id ?? `${label}:${pageN}`);

    out.push({
      id,
      label,
      page: pageN === Number.POSITIVE_INFINITY ? 1 : pageN,
      isSection,
    });
  }

  out.sort((a, b) => {
    const pa = Number.isFinite(a.page) && a.page > 0 ? a.page : Number.POSITIVE_INFINITY;
    const pb = Number.isFinite(b.page) && b.page > 0 ? b.page : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });

  // унікалізація id
  const seen = new Set<string>();
  for (let i = 0; i < out.length; i++) {
    let id = out[i].id;
    if (!id || seen.has(id)) {
      let j = 1;
      while (seen.has(`${out[i].label}:${out[i].page}:${j}`)) j++;
      id = `${out[i].label}:${out[i].page}:${j}`;
      out[i] = { ...out[i], id };
    }
    seen.add(id);
  }

  return JSON.parse(JSON.stringify(out));
}

/* ───── Metadata ───── */
export async function generateMetadata({ params }: { params: { slug: string | string[] } }): Promise<Metadata> {
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

/* ───── Page ───── */
export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string | string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const data = slug ? await getMeta(slug) : null;

  const rawContent = (data as any)?.content ?? (data as any)?.toc ?? (data as any)?.tableOfContents;
  const content = sanitizeContent(rawContent);

  // Фолбек: якщо meta немає — дозволяємо прямий перегляд через ?file=
  if (!data?.file) {
    const fileParam = typeof searchParams.file === "string" ? searchParams.file : "";
    if (fileParam && PDF_URL_RE.test(fileParam)) {
      const PublicViewer = (await import("app/public/PublicViewer")).default;
      const title = data?.meta?.title || slug || "Preview";
      return (
        <PublicViewer
          file={fileParam}
          title={title}
          bookmarks={sanitizeBookmarks(data?.bookmarks)}
          ads={sanitizeAds((data as any)?.ads)}
          content={content}
        />
      );
    }
    const ClientFallback = (await import("app/(public)/unison-directory/[slug]/ClientFallback")).default;
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
      content={content}
    />
  );
}
