"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const PublicViewer = dynamic(() => import("app/public/PublicViewer"), { ssr: false });

type Bookmark = { id: string; page: number; label: string; color: string | null };
type AdSlot    = { id: string; imageUrl: string; href?: string | null; label?: string | null; seq?: number | null };
type TocItem   = { id: string; label: string; page: number; isSection?: boolean };

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[];
  ads?: AdSlot[];
  /** нове: справжні пункти змісту з content.json */
  content?: unknown;
  toc?: unknown;
  tableOfContents?: unknown;
};

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
  return JSON.parse(JSON.stringify(out));
}

function sanitizeAds(input: unknown): AdSlot[] {
  if (!Array.isArray(input)) return [];
  const out: AdSlot[] = [];
  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const anyIt = it as Record<string, unknown>;
    const id = String(anyIt.id ?? "");
    const imageUrl = String(
      (anyIt.imageUrl as any) ??
      (anyIt.url as any) ??
      (anyIt.image as any) ??
      (anyIt.img as any) ??
      ""
    ).trim();
    if (!imageUrl) continue;
    const href   = anyIt.href   == null ? null : String(anyIt.href).trim() || null;
    const label  = anyIt.label  == null ? null : String(anyIt.label).trim() || null;
    const seqNum = Number(anyIt.seq);
    const seq    = Number.isFinite(seqNum) ? (seqNum as number) : null;
    out.push({ id, imageUrl, href, label, seq });
  }
  return out.sort((a,b)=>(a.seq ?? 999)-(b.seq ?? 999)).slice(0,5);
}

/** sanitize content.json → RightContentPanel items */
function sanitizeContent(input: unknown): TocItem[] {
  if (!Array.isArray(input)) return [];
  const out: TocItem[] = [];

  const normPage = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : Number.POSITIVE_INFINITY;
  };

  for (const it of input) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;

    const rawLabel = (o.label ?? o.title ?? o.name) as unknown;
    const rawPage  = (o.page ?? o.p ?? o.pageNumber) as unknown;
    const rawSec   = (o.isSection ?? o.section ?? o.isHeader ?? (o.type === "section")) as unknown;

    const label = String(rawLabel ?? "").trim();
    const pageN = normPage(rawPage);
    if (!label) continue; // без назви не показуємо

    // стабільний id
    const id = String(o.id ?? `${label}:${pageN}`);

    out.push({
      id,
      label,
      page: pageN === Number.POSITIVE_INFINITY ? 1 : pageN,
      isSection: Boolean(rawSec),
    });
  }

  // сортування: page ASC (∞ — внизу), далі label ASC (case-insensitive)
  out.sort((a, b) => {
    const pa = Number.isFinite(a.page) && a.page > 0 ? a.page : Number.POSITIVE_INFINITY;
    const pb = Number.isFinite(b.page) && b.page > 0 ? b.page : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });

  return JSON.parse(JSON.stringify(out));
}

const PDF_URL_RE = /^https?:\/\/.+\.pdf(\?.*)?$/i;

export default function ClientFallback() {
  const pathname = usePathname();
  const sp = useSearchParams();

  const [ready, setReady] = useState<{
    file: string;
    title?: string;
    bookmarks: Bookmark[];
    ads: AdSlot[];
    content: TocItem[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const slug = useMemo(() => {
    const m = pathname?.match(/\/directory\/([^/?#]+)/i);
    return m?.[1] ?? null;
  }, [pathname]);

  useEffect(() => {
    if (!slug) {
      setErr("Missing slug in /directory/[slug].");
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(`/api/directory/${encodeURIComponent(slug)}`, { cache: "no-store" });
        let meta: MetaPayload | null = null;
        if (r.ok) meta = (await r.json()) as MetaPayload;

        const fileFromMeta  = meta?.file;
        const fileFromQuery = sp.get("file") ?? undefined;
        const file = (fileFromMeta || fileFromQuery || "").trim();

        if (!file) {
          if (!cancelled) setErr(`Expected meta at /api/directory/${slug} or ?file= param.`);
          return;
        }
        if (!PDF_URL_RE.test(file)) {
          if (!cancelled) setErr("Invalid PDF url. Expected public https://…/*.pdf");
          return;
        }

        const bookmarks = sanitizeBookmarks(meta?.bookmarks);
        const ads       = sanitizeAds(meta?.ads);
        const rawContent = (meta as any)?.content ?? (meta as any)?.toc ?? (meta as any)?.tableOfContents;
        const content   = sanitizeContent(rawContent);
        const title     = meta?.meta?.title || slug;

        if (!cancelled) setReady({ file, title, bookmarks, ads, content });
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      }
    })();

    return () => { cancelled = true; };
  }, [slug, sp]);

  if (ready) {
    return (
      <PublicViewer
        file={ready.file}
        title={ready.title}
        bookmarks={ready.bookmarks}
        ads={ready.ads}
        content={ready.content}
      />
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Not found</h2>
      <p>{err ?? "Loading…"}</p>
    </div>
  );
}
