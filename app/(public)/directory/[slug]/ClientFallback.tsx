// app/(public)/directory/[slug]/ClientFallback.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const PublicViewer = dynamic(() => import("app/public/PublicViewer"), { ssr: false });

type Bookmark = { id: string; page: number; label: string; color: string | null };
type AdSlot    = { id: string; imageUrl: string; href?: string | null; label?: string | null; seq?: number | null };

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[];
  ads?: AdSlot[];
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
    const imageUrl = String(anyIt.imageUrl ?? "").trim();
    if (!imageUrl) continue;
    const href   = anyIt.href   == null ? null : String(anyIt.href).trim() || null;
    const label  = anyIt.label  == null ? null : String(anyIt.label).trim() || null;
    const seqNum = Number(anyIt.seq);
    const seq    = Number.isFinite(seqNum) ? (seqNum as number) : null;
    out.push({ id, imageUrl, href, label, seq });
  }
  return out.sort((a,b)=>(a.seq ?? 999)-(b.seq ?? 999)).slice(0,5);
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
        const title     = meta?.meta?.title || slug;

        if (!cancelled) setReady({ file, title, bookmarks, ads });
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
