// app/secure/editor/LeftAdsPanel.tsx
"use client";

import React from "react";

type AdSlotView = {
  id: string;
  imageUrl: string;
  href?: string | null;
  label?: string | null;
  /** може прилітати з API — не обов’язкове */
  seq?: number | null;
};

type LeftAdsPanelProps = {
  /** Зовнішній прапорець: чи має панель бути згорнута */
  autoCollapsed?: boolean;
  /** Рекламні слоти з опублікованих метаданих */
  items?: AdSlotView[];
};

export default function LeftAdsPanel({ autoCollapsed, items }: LeftAdsPanelProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const hoverRef = React.useRef(false);
  const [collapsed, setCollapsed] = React.useState(false);

  // 1) Використовуємо ТІЛЬКИ те, що прийшло ззовні; сортуємо за seq якщо є
  const data: AdSlotView[] = React.useMemo(() => {
    const list = Array.isArray(items) ? items.slice() : [];
    if (list.length > 0) {
      list.sort((a, b) => (a.seq ?? 999) - (b.seq ?? 999));
      return list;
    }
    // 2) Плейсхолдери — лише якщо даних немає зовсім
    return [
      { id: "ph-1", imageUrl: "", href: null, label: "AD 1" },
      { id: "ph-2", imageUrl: "", href: null, label: "AD 2" },
    ];
  }, [items]);

  // Синхронізація з зовнішнім прапорцем
  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  // Безкінечний повільний автоскрол (швидкість НЕ змінюю)
  React.useEffect(() => {
    const step = 0.5; // px
    const intervalMs = 30;
    const id = window.setInterval(() => {
      const node = scrollRef.current;
      if (!node) return;
      if (hoverRef.current) return;
      if (node.scrollHeight <= node.clientHeight) return;
      const half = node.scrollHeight / 2;
      node.scrollTop = node.scrollTop >= half ? 0 : node.scrollTop + step;
    }, intervalMs);
    return () => window.clearInterval(id);
  }, []);

  return (
    <aside
      className={`lh-leftads${collapsed ? " is-collapsed" : ""}`}
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
    >
      {/* Ручка-стрілка — без змін */}
      <button
        type="button"
        className="lh-toggle"
        aria-label={collapsed ? "Expand ads panel" : "Collapse ads panel"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="lh-leftads-inner" ref={scrollRef}>
        {/* дублюємо рівно той самий масив для безшовного циклу */}
        {data.concat(data).map((ad, i) => {
          const key = `${ad.id || "ad"}-${i}`;
          const alt = ad.label || "Ad";
          const hasImg = typeof ad.imageUrl === "string" && ad.imageUrl.trim().length > 0;
          const hasHref = typeof ad.href === "string" && ad.href.trim().length > 0;

          return (
            <div key={key} className="lh-ads-slot">
              {hasImg ? (
                hasHref ? (
                  <a href={ad.href!} target="_blank" rel="noopener noreferrer">
                    <img src={ad.imageUrl} alt={alt} />
                  </a>
                ) : (
                  <img src={ad.imageUrl} alt={alt} />
                )
              ) : (
                <span>{alt}</span>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .lh-leftads {
          position: fixed;
          left: 0;
          top: var(--hdr, 56px);
          bottom: var(--ftr, 64px);
          width: 400px;
          background: linear-gradient(180deg, #23272f, #171a20);
          padding: 18px 14px;
          z-index: 1050;
          box-shadow: 4px 0 18px rgba(0, 0, 0, 0.32);
          overflow: visible;
          transition: transform 0.35s ease;
        }
        .lh-leftads.is-collapsed {
          transform: translateX(-100%);
        }
        .lh-leftads-inner {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding-right: 6px;
        }
        .lh-ads-slot {
          flex: 0 0 600px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.09);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #d2d7e0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .lh-ads-slot img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }
        .lh-toggle {
          position: absolute;
          top: 50%;
          right: -40px;
          transform: translateY(-50%);
          width: 40px;
          height: 80px;
          border: 0;
          border-radius: 0 12px 12px 0;
          background: rgba(0, 0, 0, 0.35);
          box-shadow: 4px 0 10px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lh-toggle::before {
          content: "";
          display: block;
          width: 18px;
          height: 18px;
          border-left: 3px solid rgba(255, 255, 255, 0.9);
          border-top: 3px solid rgba(255, 255, 255, 0.9);
          transform: rotate(-45deg);
        }
        .lh-leftads.is-collapsed .lh-toggle::before {
          transform: rotate(135deg);
        }
        .lh-toggle:hover {
          background: rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </aside>
  );
}
