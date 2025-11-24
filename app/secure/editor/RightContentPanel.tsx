// app/secure/editor/RightContentPanel.tsx
"use client";

import React from "react";

export type TocItem = {
  id: string;
  label: string;      // не показуємо порожні
  page: number;       // 1-based, > 0
  isSection?: boolean;
};

type Props = {
  autoCollapsed?: boolean;
  items?: TocItem[] | null | undefined;
  onGotoPage?: (page: number) => void;
};

export default function RightContentPanel({ autoCollapsed, items, onGotoPage }: Props) {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);

  // ✅ ТІЛЬКИ РЕАЛЬНІ ДАНІ. ЖОДНИХ ПЛЕЙСХОЛДЕРІВ.
  const toc: TocItem[] = React.useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    const norm = src
      .map((x) => ({
        id: String(x?.id ?? "").trim(),
        label: String(x?.label ?? "").trim(),
        page: Number.isFinite((x as any)?.page) ? Math.max(1, Math.floor((x as any).page)) : NaN,
        isSection: !!x?.isSection,
      }))
      // фільтруємо сміття
      .filter((x) => x.id.length > 0 && x.label.length > 0 && Number.isFinite(x.page))
      // сортування: спершу сторінка, далі — назва (case-insensitive)
      .sort((a, b) => (a.page - b.page) || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

    return norm; // без фолбеків
  }, [items]);

  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  // Клавіатура
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
    <aside className={`rc-rightpanel${collapsed ? " is-collapsed" : ""}`} aria-label="Contents">
      {/* ручка-стрілка */}
      <button
        type="button"
        className="rc-toggle"
        aria-label={collapsed ? "Expand contents" : "Collapse contents"}
        title={collapsed ? "Show contents" : "Hide contents"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="rc-inner" role="list" ref={listRef} onKeyDown={onKeyList}>
        <div className="rc-title" aria-hidden>Content Table</div>

        {toc.length === 0 ? (
          <div className="rc-empty" role="note" aria-live="polite">
            No items yet.
          </div>
        ) : (
          toc.map((it, i) => {
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
          })
        )}
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

        .rc-empty {
          color: #b9c2cf;
          opacity: .9;
          padding: 10px 12px;
          font-size: 14px;
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

        .rc-item.is-section { padding-left: 8px; }
        .rc-item.is-section .rc-label { font-weight: 800; font-size: 15px; letter-spacing: .01em; }
        .rc-item.is-section .rc-dot { background: #f4ce69; box-shadow: 0 0 0 3px rgba(244,206,105,.15); }

        .rc-item.is-page { padding-left: 28px; }
        .rc-item.is-page .rc-dot { background: #9aa4b2; opacity: .9; }

        .rc-dot { width: 10px; height: 10px; border-radius: 50%; }

        .rc-label {
          font-size: 14px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .rc-page { font-weight: 900; font-size: 12px; color: #f4ce69; letter-spacing: .02em; }

        @media (prefers-reduced-motion: reduce) {
          .rc-rightpanel, .rc-item { transition: none !important; }
        }
      `}</style>
    </aside>
  );
}
