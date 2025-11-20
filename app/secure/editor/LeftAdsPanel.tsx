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
          left: 0;
          /* Між хедером і футером, не перекриваємо їх */
          top: var(--hdr, 56px);
          bottom: var(--ftr, 64px);

          width: 400px;
          background: linear-gradient(180deg, #23272f, #171a20);
          padding: 18px 14px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 1050;
          box-shadow: 4px 0 18px rgba(0, 0, 0, 0.32);
        }

        .lh-ads-slot {
          /* Картки вдвічі вищі: було 110px */
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
