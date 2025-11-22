// app/secure/editor/LeftAdsPanel.tsx
"use client";

import React from "react";

type AdSlotView = {
  id: string;
  imageUrl: string;
  href?: string | null;
  label?: string | null;
};

type LeftAdsPanelProps = {
  /** Зовнішній прапорець: чи має панель бути згорнута */
  autoCollapsed?: boolean;
  /** Рекламні слоти, які приходять з опублікованих метаданих */
  items?: AdSlotView[];
};

export default function LeftAdsPanel({ autoCollapsed, items }: LeftAdsPanelProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const hoverRef = React.useRef(false);
  const [collapsed, setCollapsed] = React.useState(false);

  // 1) Беремо реальні items; якщо порожньо — короткий плейсхолдер
  const ads: AdSlotView[] = React.useMemo(() => {
    if (Array.isArray(items) && items.length) return items;
    return [
      { id: "placeholder-1", imageUrl: "", href: null, label: "AD 1" },
      { id: "placeholder-2", imageUrl: "", href: null, label: "AD 2" },
    ];
  }, [items]);

  // 2) Синхронізація згортання із зовнішнім прапорцем
  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  // 3) Автоскрол вгору по колу (як було)
  React.useEffect(() => {
    const step = 0.5;
    const intervalMs = 30;
    const id = window.setInterval(() => {
      const node = scrollRef.current;
      if (!node || hoverRef.current) return;
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
      {/* Ручка-стрілка (без змін) */}
      <button
        type="button"
        className="lh-toggle"
        aria-label={collapsed ? "Expand ads panel" : "Collapse ads panel"}
        title={collapsed ? "Expand ads panel" : "Collapse ads panel"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="lh-leftads-inner" ref={scrollRef} data-ads-count={ads.length} data-valid-ads={ads.filter(a=>a.imageUrl).length}>
        {/* дублюємо список, щоб зробити безкінечну карусель */}
        {ads.concat(ads).map((ad, i) => {
          const hasImg = typeof ad.imageUrl === "string" && ad.imageUrl.trim() !== "";
          return (
            <div
              key={`${ad.id}-${i}`}
              className="lh-ads-slot"
              data-ad-id={ad.id}
              data-has-img={hasImg ? "true" : "false"}
            >
              {hasImg ? (
                ad.href ? (
                  <a
                    href={ad.href!}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    title={ad.label ?? undefined}
                    className="ad-link"
                  >
                    <img src={ad.imageUrl} alt={ad.label || "Advertisement"} />
                  </a>
                ) : (
                  <img src={ad.imageUrl} alt={ad.label || "Advertisement"} />
                )
              ) : (
                <span className="ad-ph">{ad.label ?? "AD"}</span>
              )}

              {/* Лейбл тільки як плейсхолдер; якщо є зображення — ховаємо через CSS */}
              <span className="ad-label">{ad.label ?? ""}</span>
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
          position: relative;             /* важливо для коректного шару лейбла */
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
          overflow: hidden;               /* щоб картинка не виходила за радіус */
        }

        .lh-ads-slot img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }

        /* Плейсхолдер по центру */
        .lh-ads-slot .ad-ph {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.6;
        }

        /* Допоміжний елемент-лейбл: ховаємо, якщо є зображення */
        .lh-ads-slot .ad-label {
          position: absolute;
          left: 8px;
          bottom: 8px;
          font-size: 10px;
          opacity: 0.7;
          pointer-events: none;
        }
        .lh-ads-slot[data-has-img="true"] .ad-ph,
        .lh-ads-slot[data-has-img="true"] .ad-label {
          display: none !important;       /* ← не перекриваємо зображення */
        }

        /* Ручка-стрілка */
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
