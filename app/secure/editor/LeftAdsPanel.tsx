// app/secure/editor/LeftAdsPanel.tsx
"use client";

import React from "react";

type CardItem = {
  id: string;
  imageUrl: string;
  href?: string | null;
  label?: string | null;
  seq?: number | null;
};

type LeftRailProps = {
  /** Зовнішній прапорець: чи має панель бути згорнута */
  autoCollapsed?: boolean;
  /** Елементи підсвітки сторінок (meta.json) */
  items?: CardItem[] | null | undefined;
};

export default function LeftRailPanel({ autoCollapsed, items }: LeftRailProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const hoverRef = React.useRef(false);
  const [collapsed, setCollapsed] = React.useState(false);

  /** 1) Нормалізація вхідних елементів */
  const apiItems = React.useMemo<CardItem[]>(() => {
    if (!Array.isArray(items)) return [];
    return items
      .map((a) => ({
        id: String(a?.id ?? ""),
        imageUrl: String(a?.imageUrl ?? "").trim(),
        href: a?.href ? String(a.href).trim() : null,
        label: a?.label ? String(a.label).trim() : null,
        seq: Number.isFinite(a?.seq as any) ? (a!.seq as number) : null,
      }))
      .filter((a) => a.imageUrl.length > 0)
      .sort((a, b) => (a.seq ?? 999) - (b.seq ?? 999));
  }, [items]);

  /** 2) Джерело для відмальовки (без дублювання) */
  const cards: CardItem[] = React.useMemo(() => {
    if (apiItems.length > 0) return apiItems;
    return [
      { id: "ph-1", imageUrl: "", href: null, label: "Feature 1" },
      { id: "ph-2", imageUrl: "", href: null, label: "Feature 2" },
    ];
  }, [apiItems]);

  /** 3) Синхронізація згортання */
  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  /** 4) Автоскрол без дублювання: переставляємо перший елемент у кінець */
  React.useEffect(() => {
    const step = 0.5;      // швидкість
    const intervalMs = 30; // інтервал

    const id = window.setInterval(() => {
      const node = scrollRef.current;
      if (!node) return;
      if (hoverRef.current) return;
      if (node.scrollHeight <= node.clientHeight) return;

      // рухаємо вгору
      node.scrollTop += step;

      // якщо перший слот проскролився повністю — переносимо його в кінець
      const first = node.firstElementChild as HTMLElement | null;
      if (!first) return;

      // враховуємо вертикальний gap
      const cs = getComputedStyle(node);
      const gapY =
        parseFloat((cs as any).rowGap || (cs as any).gap || "0") || 0;

      const threshold = first.getBoundingClientRect().height + gapY;

      if (node.scrollTop >= threshold - 0.5 /* невеликий допуск */) {
        node.appendChild(first);
        node.scrollTop -= threshold; // без ривка
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [cards.length]);

  return (
    <aside
      className={`lh-leftrail${collapsed ? " is-collapsed" : ""}`}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      data-items-count={cards.length}
      data-valid-count={apiItems.length}
    >
      {/* Ручка-стрілка */}
      <button
        type="button"
        className="lh-toggle"
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
        onClick={() => setCollapsed((v) => !v)}
      />

      <div className="lh-leftrail-inner" ref={scrollRef}>
        {cards.map((card) => {
          const img = card.imageUrl;
          return (
            <div
              key={card.id}
              className="lh-card-slot"
              data-item-id={card.id}
              data-has-img={Boolean(img)}
            >
              {img ? (
                card.href ? (
                  <a
                    href={card.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rail-link"
                    title={card.label || undefined}
                  >
                    <img src={img} alt={card.label || "Feature"} />
                    {card.label ? <span className="sr-only">{card.label}</span> : null}
                  </a>
                ) : (
                  <img src={img} alt={card.label || "Feature"} />
                )
              ) : (
                <span className="rail-ph">{card.label || "Feature"}</span>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .lh-leftrail {
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
        .lh-leftrail.is-collapsed { transform: translateX(-100%); }

        .lh-leftrail-inner {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;            /* скрол працює, але смуги не видно */
          overscroll-behavior: contain;
          padding-right: 0;

          /* повне приховування скролбарів у всіх браузерах */
          -ms-overflow-style: none;    /* IE/Edge legacy */
          scrollbar-width: none;       /* Firefox */
        }
        .lh-leftrail-inner::-webkit-scrollbar {
          width: 0; height: 0;         /* Chrome/Safari/Opera */
          display: none;
        }

        .lh-card-slot {
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
        .lh-card-slot img {
          display: block;
          width: 100%;
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
        .lh-leftrail.is-collapsed .lh-toggle::before { transform: rotate(135deg); }

        .rail-link { display: block; line-height: 0; }
        .rail-ph   { opacity: .7; }
        .sr-only {
          position: absolute;
          width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
      `}</style>
    </aside>
  );
}
