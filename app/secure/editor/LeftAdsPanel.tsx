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
  autoCollapsed?: boolean;
  items?: AdSlotView[];
};

export default function LeftAdsPanel({ autoCollapsed, items }: LeftAdsPanelProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const hoverRef = React.useRef(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const ads: AdSlotView[] = React.useMemo(() => {
    if (items && items.length > 0) return items;
    return [
      { id: "placeholder-1", imageUrl: "", href: null, label: "AD 1" },
      { id: "placeholder-2", imageUrl: "", href: null, label: "AD 2" },
    ];
  }, [items]);

  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

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
      <button
        type="button"
        className="lh-toggle"
        aria-label={collapsed ? "Expand ads panel" : "Collapse ads panel"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="lh-leftads-inner" ref={scrollRef}>
        {ads.concat(ads).map((ad, i) => {
          const key = `${ad.id}-${i}`;
          const label = ad.label || "";
          const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) =>
            ad.href ? (
              <a
                href={ad.href}
                target="_blank"
                rel="noopener noreferrer"
                className="ad-overlay"
                aria-label={label || "Open sponsor link"}
                title={label || undefined}
              >
                {children}
              </a>
            ) : (
              <div className="ad-overlay no-link" title={label || undefined}>
                {children}
              </div>
            );

          return (
            <div key={key} className="lh-ads-slot">
              {ad.imageUrl ? (
                <>
                  <img src={ad.imageUrl} alt={label || "Ad"} />
                  <Overlay>
                    {label ? <span className="ad-label">{label}</span> : null}
                  </Overlay>
                </>
              ) : (
                <span className="ad-ph">{label || `AD ${i + 1}`}</span>
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
        .lh-leftads.is-collapsed { transform: translateX(-100%); }

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
          position: relative;             /* потрібно для оверлею */
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
          overflow: hidden;               /* щоб оверлей не вилазив */
        }

        .lh-ads-slot img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }

        /* прозорий шар поверх картинки — для лейблу/лінку на ховері */
        .ad-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.0);
          color: #fff;
          text-decoration: none;
          opacity: 0;
          transition: opacity .18s ease, background .18s ease;
        }
        .lh-ads-slot:hover .ad-overlay {
          opacity: 1;
          background: rgba(0,0,0,0.25);
        }
        .ad-overlay.no-link { cursor: default; }

        .ad-label {
          padding: 6px 10px;
          border-radius: 8px;
          background: rgba(0,0,0,0.55);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: .02em;
        }

        .ad-ph { opacity: .7; }

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
        .lh-leftads.is-collapsed .lh-toggle::before { transform: rotate(135deg); }
        .lh-toggle:hover { background: rgba(0, 0, 0, 0.5); }
      `}</style>
    </aside>
  );
}
