// app/public/AdRail.tsx
"use client";

import React from "react";

type Props = {
  open: boolean;                // чи відкрита панель зараз
  onToggle: () => void;         // клік по стрілці
  // коли титулка — показуємо панель автоматично (батько керує open),
  // у картках — нейтральний текст англійською
};

export default function AdRail({ open, onToggle }: Props) {
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

      {/* ізольовані стилі */}
      <style jsx>{`
        .ad-rail {
          position: fixed;
          inset: 80px auto 24px 0; /* під хедером, над футером */
          width: 240px;
          transform: translateX(-212px); /* захована (залишається вушка-стрілка) */
          transition: transform 260ms ease, opacity 260ms ease;
          z-index: 30;
          pointer-events: none; /* щоб не заважати клікам у вьювері, крім самої панелі */
        }
        .ad-rail.is-open {
          transform: translateX(0);
          pointer-events: auto;
        }

        .ad-toggle {
          position: absolute;
          top: 40%;
          right: -28px;
          width: 28px;
          height: 56px;
          border-radius: 0 8px 8px 0;
          border: none;
          background: #e3e7ea;
          color: #1a2b2f;
          font-size: 20px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,.25);
          pointer-events: auto;
        }
        .chev {
          display: block;
          transform: translateY(-1px);
          user-select: none;
        }

        .ad-rail-inner {
          height: 100%;
          width: 100%;
          overflow: auto;
          padding: 12px;
          background: #24363b; /* близько до фону в’ювера */
          border-right: 1px solid rgba(255,255,255,.08);
          box-shadow: 0 6px 18px rgba(0,0,0,.35);
          border-radius: 0 8px 8px 0;
        }

        .ad-card {
          background: #2b4046;
          border: 2px dashed #ff4d4f;  /* тимчасовий червоний бордер як у макеті */
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 12px;
          min-height: 84px;
          display: grid;
          align-content: center;
        }
        .ad-title {
          font-weight: 700;
          font-size: 14px;
          color: #fff;
          margin-bottom: 4px;
        }
        .ad-text {
          font-size: 12px;
          color: #c7d3d8;
          line-height: 1.25;
        }

        @media (max-width: 980px) {
          .ad-rail { display: none; }
        }
      `}</style>
    </aside>
  );
}
