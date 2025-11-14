"use client";

import React, { useEffect } from "react";
import MobileSwipe from "./MobileSwipe";

type Ctrl = any;

type Props = {
  ctrl: Ctrl;
  file: string;
  title?: string;

  // з MobileHeader (сумісність)
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  runSearch: (q: string) => void;
  searching: boolean;
  hits: { id: string; page: number; snippet: string }[];
  onGoto: (p: number) => void;

  // проброс з MobileHeader, навіть якщо не використовуємо тут
  onShare?: () => void;
};

export default function MobilePager(p: Props) {
  const { ctrl } = p;

  // ---- Рендеримо лише поточну та підігріваємо сусідів ----
  const pageNum = ctrl.currentIndex + 1;
  useEffect(() => {
    try {
      ctrl.ensureRendered?.(ctrl.currentIndex);
    } catch {}
    try {
      ctrl.warmPagesAround?.(ctrl.currentIndex);
    } catch {}
  }, [ctrl.currentIndex]);

  const bmp = ctrl.cacheRef.current.get(pageNum);

  // ===== ЗУМ/ПАНОРАМУВАННЯ (локальний стейт) =====
  const pageRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);

  // Скидання зума при зміні сторінки / пошуку
  useEffect(() => {
    setZoom(1);
    setTx(0);
    setTy(0);
  }, [pageNum, p.searchQuery]);

  // Пінч/пан логіка
  const startDist = React.useRef<number | null>(null);
  const lastZoom = React.useRef(1);
  const pts = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const baseDist = React.useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = Array.from(pts.current.values());
      baseDist.current = Math.hypot(a.x - b.x, a.y - b.y);
      startDist.current = baseDist.current;
      lastZoom.current = zoom;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.current.size === 2 && baseDist.current) {
      const [a, b] = Array.from(pts.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = dist / baseDist.current;
      const next = Math.max(1, Math.min(3, lastZoom.current * factor));
      setZoom(next);
    } else if (pts.current.size === 1 && zoom > 1) {
      const prev = pts.current.get(e.pointerId)!;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setTx((v) => v + dx);
      setTy((v) => v + dy);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) baseDist.current = null;
  };

  // м’які межі пану
  const maxPan = 180;
  const tX = Math.max(-maxPan, Math.min(maxPan, tx));
  const tY = Math.max(-maxPan, Math.min(maxPan, ty));

  // ===== ЛЕЙАУТ: сцена між хедером і локальним футером =====
  // На мобільному хедер окремим компонентом зверху (56px).
  const HEADER_PX = 56;
  const FOOTER_PX = 56;

  const rootStyle: React.CSSProperties = {
    // використовуємо динамічну висоту з контролера (visualViewport)
    height: `calc(var(--app-h, 100dvh) - ${HEADER_PX}px)`,
    display: "grid",
    gridTemplateRows: `1fr ${FOOTER_PX}px`, // канва + футер
    background: "#21353a",
    minHeight: 0,
  };

  return (
    <div className="mpg-root" style={rootStyle}>
      {/* Канва з однією сторінкою */}
      <div
        // ВАЖЛИВО: stageRef тільки на області сторінки, без локального футера
        ref={ctrl.stageRef}
        className="mpg-canvas"
        style={{
          display: "grid",
          placeItems: "center",
          padding: "10px 10px 12px",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <MobileSwipe
          key={ctrl.currentIndex}
          onSwipeLeft={ctrl.goNext}
          onSwipeRight={ctrl.goPrev}
          enabled
          // панорамування всередині самого елемента сторінки
          panEl={pageRef.current}
          // якщо зовнішній зум >1 — блокуємо свайп
          isZoomed={zoom > 1.01}
        >
          <div
            ref={pageRef}
            className="mpg-page"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {bmp ? (
              <>
                <img
                  src={bmp.url}
                  alt={`Page ${pageNum}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    display: "block",
                    pointerEvents: "none",
                    transform: `translate3d(${tX}px, ${tY}px, 0) scale(${zoom})`,
                    transformOrigin: "center center",
                    willChange: "transform",
                    transition: zoom === 1 ? "transform 180ms ease-out" : "none",
                  }}
                />

                {/* PDF links */}
                {(bmp.links || []).map((L: any, i: number) =>
                  L?.href ? (
                    <a
                      key={i}
                      href={L.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pdf-link"
                      style={{
                        position: "absolute",
                        left: `${L.x * 100}%`,
                        top: `${L.y * 100}%`,
                        width: `${L.w * 100}%`,
                        height: `${L.h * 100}%`,
                      }}
                    />
                  ) : (
                    <button
                      key={i}
                      className="pdf-link"
                      title="Go to"
                      onClick={() => (L.dest ? ctrl.goToDest?.(L.dest) : null)}
                      style={{
                        position: "absolute",
                        left: `${L.x * 100}%`,
                        top: `${L.y * 100}%`,
                        width: `${L.w * 100}%`,
                        height: `${L.h * 100}%`,
                      }}
                    />
                  )
                )}

                {/* search highlights */}
                <div className="mpg-hl-layer">
                  {(ctrl.pageHighlights.get(pageNum) || []).map((hl: any, i: number) => {
                    const isActive = hl.hitIndex === ctrl.activeHit;
                    return (
                      <div
                        key={i}
                        className={`hl${isActive ? " is-active" : ""}`}
                        style={{
                          position: "absolute",
                          left: `${hl.x * 100}%`,
                          top: `${hl.y * 100}%`,
                          width: `${hl.w * 100}%`,
                          height: `${hl.h * 100}%`,
                        }}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ color: "#e9f0e4", textAlign: "center" }}>Loading…</div>
            )}
          </div>
        </MobileSwipe>
      </div>

      {/* Локальний мобільний футер з навігацією */}
      <footer className="mpg-bar">
        <div className="mpg-bar__grid">
          <button
            className="mpg-btn"
            onClick={ctrl.goPrev}
            disabled={!ctrl.canPrev}
            aria-label="Previous"
            title="Previous"
          >
            ◀
          </button>

          <div className="mpg-mid">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              className="mpg-jump"
              value={ctrl.pageJump}
              onChange={(e) => ctrl.setPageJump(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") ctrl.submitJump();
              }}
              aria-label="Page"
              title="Enter page"
            />
            <span className="mpg-sep">/</span>
            <span className="mpg-total">{ctrl.totalPages || "…"}</span>
          </div>

          <button
            className="mpg-btn"
            onClick={ctrl.goNext}
            disabled={!ctrl.canNext}
            aria-label="Next"
            title="Next"
          >
            ▶
          </button>
        </div>
      </footer>

      <style jsx global>{`
        .mpg-root {
          color: #2d3018;
        }
        .mpg-canvas {
          position: relative;
        }
        .mpg-page {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: none;
          overflow: hidden;
        }
        .mpg-hl-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .mpg-bar {
          height: 56px;
          background: #ffffffef;
          border-top: 1px solid #ecefe7;
          padding: 8px;
        }
        .mpg-bar__grid {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 8px;
          align-items: center;
          height: 100%;
        }
        .mpg-btn {
          height: 36px;
          min-width: 36px;
          border: 1px solid #e6eadf;
          border-radius: 0.6rem;
          background: #fff;
        }
        .mpg-btn[disabled] {
          opacity: 0.45;
        }
        .mpg-mid {
          display: flex;
          justify-content: center;
          gap: 8px;
          align-items: center;
        }
        .mpg-jump {
          width: 72px;
          text-align: center;
          height: 36px;
          border: 1px solid #e7ebdf;
          border-radius: 0.5rem;
        }
        .mpg-sep {
          color: #5c6750;
        }
        .mpg-total {
          color: #2d3018;
        }
        .pdf-link {
          border: 0;
          background: transparent;
          display: block;
        }
        .hl {
          background: #f4ce6944;
          outline: 1px solid #f4ce69;
          border-radius: 3px;
        }
        .hl.is-active {
          background: #f47e2050;
          outline-color: #f47e20;
        }
      `}</style>
    </div>
  );
}
