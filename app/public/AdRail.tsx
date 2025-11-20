// app/public/AdRail.tsx
"use client";

import React from "react";

type Props = { open: boolean; onToggle: () => void };

export default function AdRail({ open, onToggle }: Props) {
  // тимчасовий лог для перевірки монтування
  React.useEffect(() => {
    // @ts-ignore
    console.log("[AdRail] mounted, open =", open);
  }, [open]);

  return (
    <aside className={`ad-rail ${open ? "is-open" : "is-closed"}`} aria-label="Advertising rail">
      <button
        type="button"
        className="ad-toggle"
        aria-label={open ? "Hide ads panel" : "Show ads panel"}
        title={open ? "Hide ads panel" : "Show ads panel"}
        onClick={onToggle}
      >
        <span className="chev">{open ? "‹" : "›"}</span>
      </button>

      <div className="ad-rail-inner" role="list">
        {Array.from({ length: 12 }).map((_, i) => (
          <div className="ad-card" role="listitem" key={i}>
            <div className="ad-title">Your ad could be here</div>
            <div className="ad-text">Promote your services to directory readers.</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        /* ===== СУПЕР-ЯВНІ СТИЛІ ДЛЯ ДІАГНОСТИКИ ===== */
        .ad-rail {
          position: fixed;
          top: 0;                /* без залежності від var(--hdr) */
          bottom: 0;             /* без залежності від var(--ftr) */
          left: 0;
          width: 250px;
          z-index: 99999;        /* вище за все */
          transform: translateX(0);
          transition: transform 260ms ease;
          background: rgba(255, 0, 0, 0.03); /* щоб точно було видно область */
          outline: 3px solid #ff4d4f;        /* помітний бордер для тесту */
        }
        .ad-rail.is-closed {
          transform: translateX(calc(-100% + 32px)); /* «вушко» 32px завжди видно */
        }

        .ad-toggle {
          position: absolute;
          top: 40%;
          right: -32px;
          width: 32px;
          height: 64px;
          border-radius: 0 10px 10px 0;
          border: none;
          background: #e3e7ea;
          color: #1a2b2f;
          font-size: 22px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .chev { display: block; transform: translateY(-1px); user-select: none; }

        .ad-rail-inner {
          height: 100%;
          width: 100%;
          overflow: auto;
          padding: 12px;
          background: #24363b;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          border-radius: 0 8px 8px 0;
        }

        .ad-card {
          background: #2b4046;
          border: 2px dashed #ff4d4f;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 12px;
          min-height: 84px;
          display: grid;
          align-content: center;
          color: #fff;
        }
        .ad-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .ad-text  { font-size: 12px; color: #c7d3d8; line-height: 1.25; }

        @media (max-width: 980px) {
          .ad-rail { display: none; }
        }
      `}</style>
    </aside>
  );
}
