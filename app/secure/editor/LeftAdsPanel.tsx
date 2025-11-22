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

  // Використовуємо передані items; якщо їх немає — лише скромний плейсхолдер
  const ads: AdSlotView[] = React.useMemo(() => {
    if (items && items.length > 0) return items;
    return [{ id: "placeholder-1", imageUrl: "", href: null, label: "AD 1" }];
  }, [items]);

  // Синхронізація стану згортання від зовнішнього прапорця
  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  // Автоскрол вгору по колу (без змін швидкості)
  React.useEffect(() => {
    const step = 0.5;
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
      {/* Ручка-стрілка */}
      <button
        type="button"
        className="lh-toggle"
        aria-label={collapsed ? "Expand ads panel" : "Collapse ads panel"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="lh-leftads-inner" ref={scrollRef}>
        {/* Дублюємо для безшовної каруселі */}
        {ads.concat(ads).map((ad, i) => {
          const hasImg = !!ad.imageUrl;
          const label = ad.label ?? "";
          const content = hasImg ? (
            ad.href ? (
              <a
                className="ad-link"
                href={ad.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                title={label || undefined}
              >
                <img className="ad-img" src={ad.imageUrl} alt={label || "Ad"} />
              </a>
            ) : (
              <img className="ad-img" src={ad.imageUrl} alt={label || "Ad"} />
            )
          ) : (
            <span className="ad-ph">{label || "AD"}</span>
          );

          return (
            <div
              key={`${ad.id}-${i}`}
              className="lh-ads-slot"
              data-ad-id={ad.id}
              data-has-img={hasImg ? "true" : "false"}
              data-label={label}
            >
              {content}
              {/* Маленький бейджик-лейбл (лише якщо треба) */}
              {label && hasImg && <span className="ad-label">{label}</span>}
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
          overflow: visible;
          transition: transform 0.35s ease;
          /* критично: не дозволяємо ніяким ::before/::after перекривати контент */
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
          position: relative;          /* створюємо власний контекст шарів */
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
          overflow: hidden;            /* обрізаємо, але не перекриваємо картинку */
        }

        /* Картинка завжди над фоном слоту */
        .lh-ads-slot .ad-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;           /* заповнює слот без спотворень */
          z-index: 1;
          position: relative;
          border-radius: 8px;
          pointer-events: auto;
        }

        /* Клік-зона посилання не додає власних фонів */
        .lh-ads-slot .ad-link {
          display: block;
          width: 100%;
          height: 100%;
          line-height: 0;
        }

        /* Плейсхолдер показуємо лише коли немає зображення */
        .lh-ads-slot[data-has-img="true"] .ad-ph {
          display: none !important;
        }

        /* Маленький підпис у куті поверх картинки */
        .lh-ads-slot .ad-label {
          position: absolute;
          left: 8px;
          bottom: 8px;
          z-index: 3;
          padding: 4px 6px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.45);
          color: #fff;
          font-size: 11px;
          line-height: 1;
          font-weight: 600;
          letter-spacing: 0.02em;
          pointer-events: none;
        }

        /* Ручка-стрілка */
        .lh-toggle {
          position: absolute;
          top: 50%;
          right: -40px; /* трохи назовні панелі */
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
          transform: rotate(-45deg); /* вліво */
        }
        .lh-leftads.is-collapsed .lh-toggle::before {
          transform: rotate(135deg); /* вправо */
        }
        .lh-toggle:hover {
          background: rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </aside>
  );
}

