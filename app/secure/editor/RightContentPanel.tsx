// app/secure/editor/RightContentPanel.tsx
"use client";

import React from "react";

export type TocItem = {
  id: string;
  label: string;
  page: number;        // 1-based
  isSection?: boolean; // лише для стилю (розділ)
};

type Props = {
  /** Зовнішній прапорець: чи має панель бути згорнута */
  autoCollapsed?: boolean;
  /** Список пунктів змісту (якщо приходить — використовуємо його, без дод. фетчів) */
  items?: TocItem[] | null | undefined;
  /** Клік по пункту → перехід на сторінку (1-based) */
  onGotoPage?: (page: number) => void;
};

export default function RightContentPanel({ autoCollapsed, items, onGotoPage }: Props) {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);

  /* ---------- helpers ---------- */
  const sortToc = React.useCallback((arr: TocItem[]) => {
    return [...arr].sort((a, b) => {
      const pa = Number.isFinite(a.page) && a.page > 0 ? a.page : Number.POSITIVE_INFINITY;
      const pb = Number.isFinite(b.page) && b.page > 0 ? b.page : Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa - pb;
      return String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, { sensitivity: "base" });
    });
  }, []);

  const sanitizeContent = React.useCallback((input: unknown): TocItem[] => {
    if (!Array.isArray(input)) return [];
    const normPage = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : Number.POSITIVE_INFINITY;
    };
    const out: TocItem[] = [];
    for (const it of input) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const rawLabel = (o.label ?? o.title ?? o.name) as unknown;
      const rawPage  = (o.page ?? o.p ?? o.pageNumber) as unknown;
      const rawSec   = (o.isSection ?? o.section ?? o.isHeader ?? (o.type === "section")) as unknown;

      const label = String(rawLabel ?? "").trim();
      if (!label) continue;

      const pageN = normPage(rawPage);
      const id    = String(o.id ?? `${label}:${pageN}`);

      out.push({
        id,
        label,
        page: pageN === Number.POSITIVE_INFINITY ? 1 : pageN,
        isSection: Boolean(rawSec),
      });
    }
    return sortToc(out);
  }, [sortToc]);

  const [fetched, setFetched] = React.useState<TocItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Якщо пропів немає або вони порожні — самі фетчимо content.json по slug із URL
  React.useEffect(() => {
    if (Array.isArray(items) && items.length > 0) {
      setFetched(null);
      return;
    }

    const m = typeof window !== "undefined"
      ? window.location.pathname.match(/\/directory\/([^/?#]+)/i)
      : null;
    const slug = m?.[1];
    if (!slug) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);

        // 1) /api/directory/[slug]/content
        const try1 = await fetch(`/api/directory/${encodeURIComponent(slug)}/content`, { cache: "no-store" });
        if (!cancelled && try1.ok) {
          const data = await try1.json();
          const list = sanitizeContent((data as any) ?? (data as any)?.items);
          if (list.length) {
            setFetched(list);
            return;
          }
        }

        // 2) /api/directory/[slug]?fields=content
        const try2 = await fetch(`/api/directory/${encodeURIComponent(slug)}?fields=content`, { cache: "no-store" });
        if (!cancelled && try2.ok) {
          const data = await try2.json();
          const raw  = (data as any)?.content ?? (data as any)?.toc ?? (data as any)?.tableOfContents;
          const list = sanitizeContent(raw);
          if (list.length) {
            setFetched(list);
            return;
          }
        }

        // 3) /api/directory/[slug] (повний мета-ендпоінт)
        const try3 = await fetch(`/api/directory/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (!cancelled && try3.ok) {
          const data = await try3.json();
          const raw  = (data as any)?.content ?? (data as any)?.toc ?? (data as any)?.tableOfContents;
          const list = sanitizeContent(raw);
          setFetched(list);
          return;
        }

        if (!cancelled) setFetched([]);
      } catch {
        if (!cancelled) setFetched([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [items, sanitizeContent]);

  // Вибираємо дані пріоритетно: пропи > фетч
  const toc: TocItem[] = React.useMemo(() => {
    const src = Array.isArray(items) && items.length > 0 ? items : (fetched ?? []);
    return sortToc(
      (src ?? [])
        .map((x) => ({
          id: String(x?.id ?? ""),
          label: String(x?.label ?? "").trim(),
          page: Number.isFinite(x?.page as any) ? Math.max(1, Math.floor(x!.page as number)) : 1,
          isSection: !!x?.isSection,
        }))
        .filter((x) => x.id.length > 0 && x.label.length > 0)
    );
  }, [items, fetched, sortToc]);

  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  // Клавіатурна навігація по списку
  const onKeyList = (e: React.KeyboardEvent) => {
    const root = listRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".rc-item"));
    const idx = buttons.findIndex((b) => b === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      (buttons[idx + 1] ?? buttons[0] ?? null)?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      (buttons[idx - 1] ?? buttons[buttons.length - 1] ?? null)?.focus();
    }
  };

  return (
    <aside
      className={`rc-rightpanel${collapsed ? " is-collapsed" : ""}`}
      aria-label="Contents"
    >
      <button
        type="button"
        className="rc-toggle"
        aria-label={collapsed ? "Expand contents" : "Collapse contents"}
        title={collapsed ? "Show contents" : "Hide contents"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div
        className="rc-inner"
        role="list"
        ref={listRef}
        onKeyDown={onKeyList}
      >
        <div className="rc-title" aria-hidden>Content Table</div>

        {loading && <div style={{padding:"8px 12px", color:"#9aa4b2"}}>Loading…</div>}
        {!loading && toc.length === 0 && (
          <div style={{padding:"8px 12px", color:"#9aa4b2"}}>No items yet.</div>
        )}

        {toc.map((it, i) => {
          const isSection = !!it.isSection;
          return (
            <button
              key={it.id}
              type="button"
              role="listitem"
              className={`rc-item${isSection ? " is-section" : " is-page"}`}
              onClick={() => onGotoPage?.(it.page)}
              aria-label={`${it.label}, page ${it.page}`}
              title={`${it.label} — page ${it.page}`}
            >
              <span className="rc-dot" aria-hidden />
              <span className="rc-label">{it.label}</span>
              <span className="rc-page">p.{it.page}</span>
              {i > 0 ? <span className="rc-sep" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .rc-rightpanel {
          position: fixed;
          right: 0;
          top: var(--hdr, 56px);
          bottom: var(--ftr, 64px);
          width: 360px;
          background: linear-gradient(180deg, #23272f, #171a20);
          padding: 16px 14px;
          z-index: 1050;
          box-shadow: -4px 0 18px rgba(0,0,0,.32);
          transition: transform .35s ease;
          overflow: visible;
        }
        .rc-rightpanel.is-collapsed { transform: translateX(100%); }

        .rc-toggle {
          position: absolute;
          top: 50%;
          left: -20px;
          transform: translateY(-50%);
          width: 30px;
          height: 80px;
          border: 0;
          border-radius: 12px 0 0 12px;
          background: rgba(0,0,0,.35);
          box-shadow: -4px 0 10px rgba(0,0,0,.4);
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rc-toggle::before {
          content: "";
          display: block;
          width: 18px;
          height: 18px;
          border-right: 3px solid rgba(255,255,255,.9);
          border-top: 3px solid rgba(255,255,255,.9);
          transform: rotate(45deg);
        }
        .rc-rightpanel.is-collapsed .rc-toggle::before { transform: rotate(-135deg); }

        .rc-inner {
          height: 100%;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0;
          outline: none;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .rc-inner::-webkit-scrollbar { width:0; height:0; display:none; }

        .rc-title {
          color: #e9f0e4;
          font-weight: 800;
          margin: 4px 8px 12px;
          letter-spacing: .02em;
          text-transform: uppercase;
          opacity: .9;
        }

        .rc-item {
          position: relative;
          display: grid;
          grid-template-columns: 18px 1fr auto;
          align-items: center;
          column-gap: 10px;
          padding: 10px 12px 10px 8px;
          background: transparent;
          border: 0;
          color: #d2d7e0;
          text-align: left;
          cursor: pointer;
          transition: background .16s ease, transform .06s ease, box-shadow .16s ease;
          border-radius: 12px;
        }
        .rc-item:hover,
        .rc-item:focus-visible {
          background: rgba(255,255,255,.06);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.10);
        }
        .rc-item:active { transform: translateY(1px); }

        .rc-sep {
          position: absolute;
          left: 8px;
          right: 8px;
          bottom: -1px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent);
          pointer-events: none;
        }

        /* ===== РОЗДІЛИ ===== */
        .rc-item.is-section {
          grid-template-columns: 18px 1fr auto;
          padding-left: 8px;
        }
        .rc-item.is-section .rc-label {
          font-weight: 800;
          font-size: 15px;
          letter-spacing: .01em;
        }
        /* нейтрально-сіра крапка для розділів */
        .rc-item.is-section .rc-dot {
          background: #9aa4b2;
          box-shadow: 0 0 0 3px rgba(154,164,178,.18);
        }

        /* ===== ЗВИЧАЙНІ ПУНКТИ ===== */
        .rc-item.is-page {
          padding-left: 28px; /* індентація лишається */
        }
        /* прибираємо крапку в звичайних пунктів */
        .rc-item.is-page .rc-dot {
          display: none;
        }

        .rc-dot { width: 10px; height: 10px; border-radius: 50%; }

        .rc-label {
          font-size: 14px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        /* Номери сторінок — тим же шрифтом і кольором, що й звичайний текст */
        .rc-page {
          font: inherit;
          font-size: 14px;
          font-weight: 400;
          color: inherit;
          letter-spacing: normal;
        }

        @media (prefers-reduced-motion: reduce) {
          .rc-rightpanel, .rc-item { transition: none !important; }
        }
      `}</style>
    </aside>
  );
}
