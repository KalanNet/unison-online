// app/secure/editor/LeftAdsPanel.tsx
"use client";

import React from "react";

type LeftAdsPanelProps = {
  /** Зовнішній прапорець: чи має панель бути згорнута */
  autoCollapsed?: boolean;
};

export default function LeftAdsPanel({ autoCollapsed }: LeftAdsPanelProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const hoverRef = React.useRef(false);
  const [collapsed, setCollapsed] = React.useState(false);

  // Синхронізація з зовнішнім прапорцем (фліпбук перейшов у 2-сторінковий режим)
  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") {
      setCollapsed(autoCollapsed);
    }
  }, [autoCollapsed]);

  // Автоскрол вгору по колу
  React.useEffect(() => {
    const step = 0.5; // px за тик (повільна швидкість)
    const intervalMs = 30;

    const id = window.setInterval(() => {
      const node = scrollRef.current;
      if (!node) return;
      if (hoverRef.current) return; // при наведенні — пауза
      if (node.scrollHeight <= node.clientHeight) return; // нема що крутити

      const half = node.scrollHeight / 2;

      if (node.scrollTop >= half) {
        node.scrollTop = 0; // безшовний цикл
      } else {
        node.scrollTop = node.scrollTop + step;
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, []);

  const ads = [...Array(5)].map((_, i) => `Ad ${i + 1}`);

  return (
    <aside
      className={`lh-leftads${collapsed ? " is-collapsed" : ""}`}
      onMouseEnter={() => {
        hoverRef.current = true;
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
      }}
    >
      {/* Ручка-стрілка посередині, яка згортає / розгортає панель */}
      <button
        type="button"
        className="lh-toggle"
        aria-label={collapsed ? "Expand ads panel" : "Collapse ads panel"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="lh-leftads-inner" ref={scrollRef}>
        {/* дублюємо список, щоб зробити безкінечну карусель */}
        {ads.concat(ads).map((label, i) => (
          <div key={i} className="lh-ads-slot">
            <span>{label}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .lh-leftads {
          position: fixed;
          left: 0;
          /* Між хедером і футером, не перекриваємо їх */
          top: var(--hdr, 56px);
          bottom: var(--ftr, 64px);

          width: 400px;
          background: linear-gradient(180deg, #23272f, #171a20);
          padding: 18px 14px;
          z-index: 1050;
          box-shadow: 4px 0 18px rgba(0, 0, 0, 0.32);
          overflow: visible; /* щоб стрілка могла вилазити назовні */
          transition: transform 0.35s ease;
        }

        /* коли згорнута — вся панель виїжджає вліво за екран,
           у в’юпорті лишається тільки стрілка (яка висунута назовні) */
        .lh-leftads.is-collapsed {
          transform: translateX(-100%);
        }

        .lh-leftads-inner {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto; /* ручний скрол мишкою */
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
          /* За замовчуванням — стрілка вліво (закрити панель) */
          transform: rotate(-45deg);
        }

        /* Коли панель згорнута — стрілка дивиться вправо (розгорнути) */
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
