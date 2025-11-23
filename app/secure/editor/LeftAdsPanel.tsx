// app/secure/editor/LeftAdsPanel.tsx
"use client";

import React from "react";

type AdSlotView = {
  id: string;
  imageUrl: string;
  href?: string | null;
  label?: string | null;
  seq?: number | null;
};

type LeftAdsPanelProps = {
  /** Зовнішній прапорець: чи має панель бути згорнута */
  autoCollapsed?: boolean;
  /** Рекламні слоти, що приходять із meta.json */
  items?: AdSlotView[] | null | undefined;
};

export default function LeftAdsPanel({ autoCollapsed, items }: LeftAdsPanelProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const hoverRef = React.useRef(false);
  const [collapsed, setCollapsed] = React.useState(false);

  /** 1) Нормалізація вхідних слотів з API */
  const apiAds = React.useMemo<AdSlotView[]>(() => {
    if (!Array.isArray(items)) return [];
    return items
      .map((a) => ({
        id: String(a?.id ?? ""),
        imageUrl: String(a?.imageUrl ?? "").trim(),
        href: a?.href ? String(a.href).trim() : null,
        label: a?.label ? String(a.label).trim() : null,
        seq: Number.isFinite(a?.seq as any) ? (a!.seq as number) : null,
      }))
      .filter((a) => a.imageUrl.length > 0)            // тільки з валідною картинкою
      .sort((a, b) => (a.seq ?? 999) - (b.seq ?? 999)); // послідовність
  }, [items]);

  /** 2) Джерело даних для відмальовки:
   *    - якщо є валідні apiAds — показуємо їх
   *    - якщо немає — короткий фолбек з 2 плейсхолдерів
   */
  const ads: AdSlotView[] = React.useMemo(() => {
    if (apiAds.length > 0) return apiAds;
    return [
      { id: "ph-1", imageUrl: "", href: null, label: "AD 1" },
      { id: "ph-2", imageUrl: "", href: null, label: "AD 2" },
    ];
  }, [apiAds]);

  /** 3) Синхронізація стану згортання ззовні */
  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  /** 4) Автоскрол (як було) */
  React.useEffect(() => {
    const step = 0.5;      // не змінюю швидкість
    const intervalMs = 30; // не змінюю інтервал
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

  /** 5) (опційно) Консоль для швидкої перевірки реальних даних */
  React.useEffect(() => {
    // прибери якщо зайве
    // console.log("[LeftAdsPanel] items →", items);
    // console.log("[LeftAdsPanel] apiAds →", apiAds);
  }, [items, apiAds]);

  return (
    <aside
      className={`lh-leftads${collapsed ? " is-collapsed" : ""}`}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      data-ads-count={ads.length}
      data-valid-ads={apiAds.length}
    >
      {/* Ручка-стрілка */}
      <button
        type="button"
        className="lh-toggle"
        aria-label={collapsed ? "Expand ads panel" : "Collapse ads panel"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="lh-leftads-inner" ref={scrollRef}>
        {/* дублюємо список для безкінечного скролу, як і було */}
        {ads.concat(ads).map((ad, i) => {
          const key = `${ad.id}-${i}`;
          const img = ad.imageUrl;

          return (
            <div
              key={key}
              className="lh-ads-slot"
              data-ad-id={ad.id}
              data-has-img={Boolean(img)}
            >
              {img ? (
                ad.href ? (
                  <a
                    href={ad.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ad-link"
                    title={ad.label || undefined}
                  >
                    <img src={img} alt={ad.label || "Ad"} />
                    {ad.label ? <span className="sr-only">{ad.label}</span> : null}
                  </a>
                ) : (
                  <img src={img} alt={ad.label || "Ad"} />
                )
              ) : (
                <span className="ad-ph">{ad.label || "AD"}</span>
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
          box-shadow: 4px 0 18px rgba(0,0,0,.32);
          overflow: visible;
          transition: transform .35s ease;
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
          flex: 0 0 0px;
          border-radius: 10px;
          background: rgba(255,255,255,.02);
          border: 1px solid rgba(255,255,255,.09);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #d2d7e0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .lh-ads-slot img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }

        .lh-toggle {
          position: absolute;
          top: 50%;
          right: -40px;
          transform: translateY(-50%);
          width: 40px;
          height: 80px;
          border: 0;
          border-radius: 0 12px 12px 0;
          background: rgba(0,0,0,.35);
          box-shadow: 4px 0 10px rgba(0,0,0,.4);
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
          border-left: 3px solid rgba(255,255,255,.9);
          border-top: 3px solid rgba(255,255,255,.9);
          transform: rotate(-45deg);
        }
        .lh-leftads.is-collapsed .lh-toggle::before { transform: rotate(135deg); }

        .ad-link { display: block; line-height: 0; }
        .ad-ph   { opacity: .7; }
        .sr-only {
          position: absolute;
          width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
      `}</style>
    </aside>
  );
}
