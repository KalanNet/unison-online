// app/secure/editor/LeftAdsPanel.tsx
"use client";

import React from "react";

export default function LeftAdsPanel() {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const hoverRef = React.useRef(false);

  // Автоскрол вгору по колу
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const step = 0.5; // px за тик (повільна швидкість)
    const intervalMs = 30; // інтервал анімації

    const id = window.setInterval(() => {
      const node = scrollRef.current;
      if (!node) return;
      if (hoverRef.current) return; // при наведенні — пауза
      if (node.scrollHeight <= node.clientHeight) return; // нічого крутити

      const half = node.scrollHeight / 2;

      if (node.scrollTop >= half) {
        // безшовний цикл
        node.scrollTop = 0;
      } else {
        node.scrollTop = node.scrollTop + step;
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, []);

  const handleMouseEnter = () => {
    hoverRef.current = true;
  };

  const handleMouseLeave = () => {
    hoverRef.current = false;
  };

  const ads = [...Array(5)].map((_, i) => `Ad ${i + 1}`);

  return (
    <aside className="lh-leftads">
      <div
        className="lh-leftads-inner"
        ref={scrollRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
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
          overflow: hidden; /* обрізаємо зайве всередині */
        }

        .lh-leftads-inner {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto; /* дозволяємо ручний скрол мишкою */
          overscroll-behavior: contain;
          padding-right: 6px; /* трохи місця для скролбару */
        }

        .lh-ads-slot {
          /* Картки вдвічі вищі: було 110px, тепер ~600px як у тебе */
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
      `}</style>
    </aside>
  );
}
