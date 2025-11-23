// app/secure/editor/RightContentPanel.tsx
"use client";

import React from "react";

export type TocItem = {
  id: string;
  label: string;
  page: number;         // 1-based
  isSection?: boolean;  // чекбокс у редакторі → тут лише відображення
};

type Props = {
  /** Зовнішній прапорець: чи має панель бути згорнута */
  autoCollapsed?: boolean;
  /** Список пунктів змісту */
  items?: TocItem[] | null | undefined;
  /** Клік по пункту → перехід на сторінку (1-based) */
  onGotoPage?: (page: number) => void;
};

export default function RightContentPanel({ autoCollapsed, items, onGotoPage }: Props) {
  const hoverRef = React.useRef(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const toc: TocItem[] = React.useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    const norm = src
      .map((x) => ({
        id: String(x?.id ?? ""),
        label: String(x?.label ?? "").trim() || "Untitled",
        page: Number.isFinite(x?.page as any) ? Math.max(1, Math.floor(x!.page as number)) : 1,
        isSection: !!x?.isSection,
      }))
      .filter((x) => x.id.length > 0)
      .sort((a, b) => a.page - b.page);

    // плейсхолдери, якщо пусто
    return norm.length
      ? norm
      : [
          { id: "ph-1", label: "Introduction", page: 1, isSection: true },
          { id: "ph-2", label: "Getting Started", page: 2 },
          { id: "ph-3", label: "Contacts & Help", page: 3 },
        ];
  }, [items]);

  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  return (
    <aside
      className={`rc-rightpanel${collapsed ? " is-collapsed" : ""}`}
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
      data-count={toc.length}
    >
      {/* Ручка-стрілка (з правого краю, стрілка дивиться назовні) */}
      <button
        type="button"
        className="rc-toggle"
        aria-label={collapsed ? "Expand contents" : "Collapse contents"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="rc-inner" role="list">
        <div className="rc-title" aria-hidden>Contents</div>

        {toc.map((it) => (
          <button
            key={it.id}
            type="button"
            role="listitem"
            className={`rc-item${it.isSection ? " is-section" : ""}`}
            title={it.label + " — page " + it.page}
            onClick={() => onGotoPage?.(it.page)}
          >
            <span className="rc-check" aria-hidden>{it.isSection ? "☑" : "☐"}</span>
            <span className="rc-label">{it.label}</span>
            <span className="rc-page">p.{it.page}</span>
          </button>
        ))}
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
          gap: 8px;

          /* ховаємо смуги прокрутки */
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .rc-inner::-webkit-scrollbar { width:0; height:0; display:none; }

        .rc-title {
          color: #e9f0e4;
          font-weight: 800;
          margin: 4px 4px 10px;
          letter-spacing: .02em;
          text-transform: uppercase;
          opacity: .9;
        }

        .rc-item {
          display: grid;
          grid-template-columns: 22px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 10px;
          color: #d2d7e0;
          text-align: left;
          cursor: pointer;
        }
        .rc-item:hover { background: rgba(255,255,255,.06); }
        .rc-item:active { transform: translateY(1px); }

        .rc-item.is-section {
          border-color: rgba(255,255,255,.22);
          background: rgba(255,255,255,.06);
        }

        .rc-check { font-size: 14px; opacity: .9; }
        .rc-label {
          font-size: 14px;
          line-height: 1.2;
          letter-spacing: .01em;
        }
        .rc-page {
          font-weight: 800;
          font-size: 12px;
          color: #f4ce69;
        }
      `}</style>
    </aside>
  );
}
