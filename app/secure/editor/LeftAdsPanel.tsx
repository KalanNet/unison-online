// app/secure/editor/LeftAdsPanel.tsx
"use client";

import React from "react";

export default function LeftAdsPanel() {
  return (
    <aside className="lh-leftads">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="lh-ads-slot">
          <span>Ad {i + 1}</span>
        </div>
      ))}

      <style jsx>{`
        .lh-leftads {
          position: fixed;
          inset-block: 0;
          left: 0;
          width: 210px;
          background: linear-gradient(180deg, #23272f, #171a20);
          padding: 18px 14px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 1050;
          box-shadow: 4px 0 18px rgba(0, 0, 0, 0.32);
        }

        .lh-ads-slot {
          flex: 0 0 110px;
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
