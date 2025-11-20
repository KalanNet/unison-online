// app/public/AdRail.tsx
"use client";

import React from "react";

type Props = {
  open: boolean;
  onToggle: () => void;
};

export default function AdRail({ open, onToggle }: Props) {
  return (
    <aside
      className={`ad-rail ${open ? "is-open" : "is-closed"}`}
      aria-label="Advertising rail"
    >
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
            <div className="ad-text">
              Promote your services to directory readers.
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .ad-rail {
          position: fixed;
          top: calc(var(--hdr, 56px) + 12px);
          bottom: calc(var(--ftr, 64px) + 12px);
          left: 0;
          width: 240px;
          z-index: 310; /* нижче за search-flyout (320), вище за стрілки/рейки */
          transform: translateX(0);
          transition: transform 260ms ease;
          pointer-events: auto;
        }

        .ad-rail.is-closed {
          /* сховали, але залишили «вушко» 32px */
          transform: translateX(calc(-100% + 32px));
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
          font-size: 20px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
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
          background: #24363b;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          border-radius: 0 8px 8px 0;
        }

        .ad-card {
          background: #2b4046;
          border: 2px dashed #ff4d4f; /* поки що як у макеті, щоб явно бачилось */
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 12px;
          min-height: 84px;
          display: grid;
          align-content: center;
          color: #fff;
        }

        .ad-title {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .ad-text {
          font-size: 12px;
          color: #c7d3d8;
          line-height: 1.25;
        }

        @media (max-width: 980px) {
          .ad-rail {
            display: none;
          }
        }
      `}</style>
    </aside>
  );
}
