// app/secure/editor/LeftAdsPanel.tsx
"use client";

import React from "react";

export type AdSlotView = {
  id: string;
  imageUrl: string;
  href?: string | null;
  label?: string | null;
};

type LeftAdsPanelProps = {
  /** Зовнішній прапорець: згорнути/розгорнути (напр., коли фліпбук у 2-сторінковому режимі) */
  autoCollapsed?: boolean;
  /** Рекламні слоти з опублікованих метаданих */
  items?: AdSlotView[];
};

export default function LeftAdsPanel({ autoCollapsed, items }: LeftAdsPanelProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const pauseRef = React.useRef(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const ads = React.useMemo<AdSlotView[]>(() => {
    const list = Array.isArray(items) ? items.filter(a => a && a.imageUrl) : [];
    if (list.length) return list;
    // фолбек-плейсхолдери
    return [
      { id: "placeholder-1", imageUrl: "", href: null, label: "AD 1" },
      { id: "placeholder-2", imageUrl: "", href: null, label: "AD 2" },
    ];
  }, [items]);

  // синхронізуємося з зовнішнім прапорцем
  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  // автопрокрутка (безшовна), пауза на hover/focus/scroll
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let raf = 0;
    const stepPx = 0.5;

    const tick = () => {
      if (!el) return;
      if (!pauseRef.current && el.scrollHeight > el.clientHeight) {
        const half = el.scrollHeight / 2;
        el.scrollTop = (el.scrollTop + stepPx) % half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onPointerEnter = () => (pauseRef.current = true);
    const onPointerLeave = () => (pauseRef.current = false);
    const onWheel = () => {
      pauseRef.current = true;
      window.clearTimeout((onWheel as any)._t);
      (onWheel as any)._t = window.setTimeout(() => (pauseRef.current = false), 800);
    };

    el.addEventListener("pointerenter", onPointerEnter);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", onPointerEnter);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <aside
      className={`lh-leftads${collapsed ? " is-collapsed" : ""}`}
      aria-label="Advertising rail"
    >
      {/* ручка-стрілка, що трохи виступає за межі */}
      <button
        type="button"
        className="lh-toggle"
        aria-label={collapsed ? "Expand ads panel" : "Collapse ads panel"}
        title={collapsed ? "Show ads panel" : "Hide ads panel"}
        onClick={() => setCollapsed(v => !v)}
      >
        <span className="lh-toggle__chev" aria-hidden="true" />
      </button>

      <div
        className="lh-leftads-inner"
        ref={scrollRef}
        onFocusCapture={() => (pauseRef.current = true)}
        onBlurCapture={() => (pauseRef.current = false)}
      >
        {/* дублюємо список для безшовного циклу */}
        {[...ads, ...ads].map((ad, i) => {
          const hasImg = !!ad.imageUrl;
          const key = `${ad.id}-${i}`;
          const label = ad.label || "Open";
          const LinkWrap: React.ElementType = ad.href ? "a" : "div";
          const linkProps = ad.href
            ? { href: ad.href, target: "_blank", rel: "noopener noreferrer" }
            : {};

          return (
            <div
              key={key}
              className={`lh-ads-slot${hasImg ? "" : " is-empty"}`}
              role="listitem"
              data-ad-id={ad.id}
            >
              {hasImg ? (
                <>
                  <img
                    className="lh-ads-img"
                    src={ad.imageUrl}
                    alt={ad.label || "Advertisement"}
                    draggable={false}
                  />
                  <LinkWrap
                    {...(linkProps as any)}
                    className={`slot-link${ad.href ? "" : " is-disabled"}`}
                    aria-label={ad.href ? label : undefined}
                    title={ad.href ? (ad.label || ad.href) : undefined}
                  >
                    <span className="slot-link__label">{label}</span>
                  </LinkWrap>
                </>
              ) : (
                <span className="slot-placeholder">{label}</span>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .lh-leftads{
          position:fixed;
          left:0;
          top:var(--hdr,56px);
          bottom:var(--ftr,64px);
          width:360px;
          max-width:min(28vw, 420px);
          padding:14px 12px;
          background:linear-gradient(180deg,#1b2327,#141a1d);
          border-right:1px solid rgba(255,255,255,.06);
          box-shadow:4px 0 18px rgba(0,0,0,.28);
          z-index:1050;
          overflow:visible;
          transform:translateX(0);
          transition:transform .32s cubic-bezier(.7,0,.2,1);
        }
        /* повністю згортаємо — видима лише ручка */
        .lh-leftads.is-collapsed{ transform:translateX(calc(-100%)); }

        .lh-toggle{
          position:absolute;
          top:50%;
          right:-42px; /* трошки назовні */
          transform:translateY(-50%);
          width:42px; height:82px;
          border:0; border-radius:0 12px 12px 0;
          background:rgba(0,0,0,.35);
          box-shadow:4px 0 10px rgba(0,0,0,.4);
          cursor:pointer; padding:0;
          display:flex; align-items:center; justify-content:center;
        }
        .lh-toggle:hover{ background:rgba(0,0,0,.5); }
        .lh-toggle__chev{
          display:block; width:18px; height:18px;
          border-left:3px solid #fff; border-top:3px solid #fff;
          transform:rotate(-45deg); /* вліво */
          transition:transform .2s ease;
        }
        .lh-leftads.is-collapsed .lh-toggle__chev{
          transform:rotate(135deg); /* вправо */
        }

        .lh-leftads-inner{
          height:100%; width:100%;
          display:flex; flex-direction:column; gap:14px;
          overflow-y:auto; overscroll-behavior:contain;
          padding-right:6px;
          scrollbar-width:thin;
        }

        .lh-ads-slot{
          position:relative;
          flex:0 0 520px; /* висота “фрейму” під картинку */
          border-radius:12px;
          background:#0e1215;
          border:1px solid rgba(255,255,255,.08);
          overflow:hidden;
        }
        .lh-ads-slot.is-empty{
          display:grid; place-items:center; color:#8f9aa3;
          font-size:11px; text-transform:uppercase; letter-spacing:.08em;
        }

        .lh-ads-img{
          display:block; width:100%; height:100%;
          object-fit:cover; /* картинка заповнює фрейм */
          user-select:none; -webkit-user-drag:none;
        }

        /* оверлей-посилання: показуємо на hover/focus */
        .slot-link{
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          text-decoration:none;
          color:#fff;
          background:rgba(0,0,0,0);
          opacity:0;
          transition:opacity .18s ease, background .18s ease;
        }
        .lh-ads-slot:hover .slot-link,
        .slot-link:focus-visible{
          opacity:1; background:rgba(0,0,0,.35);
          outline:2px dashed rgba(255,255,255,.6); outline-offset:-6px;
        }
        .slot-link.is-disabled{ pointer-events:none; }

        .slot-link__label{
          font-weight:800;
          padding:.4rem .6rem;
          border-radius:.6rem;
          background:rgba(0,0,0,.55);
          max-width:90%;
          text-align:center;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        @media (max-width: 920px){
          .lh-leftads{ width:min(80vw, 340px); }
          .lh-ads-slot{ flex-basis:420px; }
        }
      `}</style>
    </aside>
  );
}
