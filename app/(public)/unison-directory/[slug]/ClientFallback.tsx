"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const PublicViewer = dynamic(() => import("app/public/PublicViewer"), { ssr: false });

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

const PDF_URL_RE = /^https?:\/\/.+\.pdf(\?.*)?$/i;

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
  return out.sort((a, b) => (a.seq ?? 999) - (b.seq ?? 999)).slice(0, 5);
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

  // унікалізуємо id (на випадок дублів у джерелі)
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

/* ───── Component ───── */
export default function ClientFallback() {
  const pathname = usePathname();
  const sp = useSearchParams();

  const slug = React.useMemo(() => pathname?.match(/\/directory\/([^/?#]+)/i)?.[1] ?? null, [pathname]);
  const fileOverride = React.useMemo(() => sp.get("file") ?? undefined, [sp]);

  const [state, setState] = React.useState<{
    file: string;
    title?: string;
    bookmarks: Bookmark[];
    ads: AdSlot[];
    content: TocItem[];
    error?: string | null;
  }>({ file: "", bookmarks: [], ads: [], content: [], error: null });

  React.useEffect(() => {
    if (!slug) {
      setState((s) => ({ ...s, error: "Missing slug in /directory/[slug]." }));
      return;
    }

    const ctrl = new AbortController();
    const reqId = Symbol("req");
    let activeReq = reqId;

    (async () => {
      try {
        const res = await fetch(`/api/directory/${encodeURIComponent(slug)}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const meta = (await res.json()) as MetaPayload;
        const file = (meta?.file || fileOverride || "").trim();
        if (!file) throw new Error(`Expected meta at /api/directory/${slug} or ?file= param.`);
        if (!PDF_URL_RE.test(file)) throw new Error("Invalid PDF url. Expected public https://…/*.pdf");

        const bookmarks = sanitizeBookmarks(meta?.bookmarks);
        const ads = sanitizeAds(meta?.ads);
        const rawContent = meta?.content ?? meta?.toc ?? meta?.tableOfContents;
        const content = sanitizeContent(rawContent);
        const title = meta?.meta?.title || slug;

        if (activeReq === reqId) {
          setState({ file, title, bookmarks, ads, content, error: null });
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (activeReq === reqId) {
          setState((s) => ({ ...s, error: String(e?.message || e) }));
        }
      }
    })();

    return () => {
      activeReq = Symbol("cancelled");
      ctrl.abort();
    };
  }, [slug, fileOverride]);

  if (state.file && !state.error) {
    return (
      <PublicViewer
        file={state.file}
        title={state.title}
        bookmarks={state.bookmarks}
        ads={state.ads}
        content={state.content}
      />
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Not found</h2>
      <p>{state.error ?? "Loading…"}</p>
    </div>
  );
}
