// app/(public)/directory/[slug]/ClientFallback.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// Динамічно підтягуємо публічний в’ювер (жодних require)
const PublicViewer = dynamic(() => import("app/public/PublicViewer"), { ssr: false });

/* ---------- Types ---------- */
type Bookmark = { id: string; page: number; label: string; color: string | null };

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null; slug?: string };
  file?: string;
  publishedAt?: string;
  bookmarks?: Bookmark[];
};

/* ---------- Helpers ---------- */
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
  // гарантуємо серіалізованість
  return JSON.parse(JSON.stringify(out));
}

const PDF_URL_RE = /^https?:\/\/.+\.pdf(\?.*)?$/i;

/* ---------- Component ---------- */
export default function ClientFallback() {
  const pathname = usePathname();
  const sp = useSearchParams();

  const [ready, setReady] = useState<{
    file: string;
    title?: string;
    bookmarks: Bookmark[];
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
        // 1) Пробуємо отримати метадані
        const r = await fetch(`/api/directory/${encodeURIComponent(slug)}`, { cache: "no-store" });
        let meta: MetaPayload | null = null;
        if (r.ok) meta = (await r.json()) as MetaPayload;

        // 2) Визначаємо файл: з meta.json або з ?file=
        const fileFromMeta = meta?.file;
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

        // 3) Санітуємо закладки (якщо є)
        const bookmarks = sanitizeBookmarks(meta?.bookmarks);
        const title = meta?.meta?.title || slug;

        if (!cancelled) setReady({ file, title, bookmarks });
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, sp]);

  if (ready) {
    return (
      <PublicViewer
        file={ready.file}
        title={ready.title}
        bookmarks={ready.bookmarks}
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
