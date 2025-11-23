// app/secure/editor/RightContentPanel.tsx
"use client";

import React from "react";

export type TocItem = {
  id: string;
  label: string;
  page: number;         // 1-based
  isSection?: boolean;  // лише для стилю (розділ)
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
  const listRef = React.useRef<HTMLDivElement | null>(null);
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

  // Навігація стрілками всередині списку
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
      {/* Ручка-стрілка (з правого краю, стрілка назовні) */}
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
        <div className="rc-title" aria-hidden>Contents</div>

        {toc.map((it) => (
          <button
            key={it.id}
            type="button"
            role="listitem"
            className={`rc-item${it.isSection ? " is-section" : ""}`}
            onClick={() => onGotoPage?.(it.page)}
            aria-label={`${it.label}, page ${it.page}`}
            title={`${it.label} — page ${it.page}`}
          >
            {/* маркер (розділ/звичайний) */}
            <span className="rc-dot" aria-hidden />
            {/* підпис: ховається у «спокійному» стані, показується на hover/focus */}
            <span className="rc-label">{it.label}</span>
            {/* номер сторінки завжди видимий */}
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
          width: 340px;
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
          outline: none;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .rc-inner::-webkit-scrollbar { width:0; height:0; display:none; }

        .rc-title {
          color: #e9f0e4;
          font-weight: 800;
          margin: 4px 6px 12px;
          letter-spacing: .02em;
          text-transform: uppercase;
          opacity: .9;
        }

        /* ——— Item ——— */
        .rc-item {
          display: grid;
          grid-template-columns: 18px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 12px;
          color: #d2d7e0;
          text-align: left;
          cursor: pointer;
          transition: background .18s ease, border-color .18s ease, transform .06s ease;
        }
        .rc-item:hover,
        .rc-item:focus-visible {
          background: rgba(255,255,255,.06);
          border-color: rgba(255,255,255,.18);
        }
        .rc-item:active { transform: translateY(1px); }

        /* Маркер */
        .rc-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #9aa4b2; /* звичайний */
          opacity: .9;
        }
        .rc-item.is-section .rc-dot {
          background: #f4ce69; /* акцент для розділів */
          box-shadow: 0 0 0 2px rgba(244, 206, 105, .18);
        }

        /* Лейбл – прихований у «спокої», показується на hover/focus контейнера або айтема */
        .rc-label {
          font-size: 14px;
          line-height: 1.2;
          letter-spacing: .01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          transition: max-width .18s ease, opacity .18s ease, transform .18s ease;
        }
        /* стан спокою: текст прихований, залишається лише крапка + номер сторінки */
        .rc-rightpanel:not(:hover):not(:focus-within) .rc-label {
          opacity: 0;
          transform: translateX(-6px);
          max-width: 0;
        }

        .rc-page {
          font-weight: 800;
          font-size: 12px;
          color: #f4ce69;
        }

        /* Менше анімацій, якщо користувач цього бажає */
        @media (prefers-reduced-motion: reduce) {
          .rc-rightpanel,
          .rc-item,
          .rc-label { transition: none !important; }
        }
      `}</style>
    </aside>
  );
}
