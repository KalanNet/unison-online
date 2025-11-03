"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Ctrl = any;

type Props = {
  ctrl: Ctrl;
  file: string;
  title?: string;

  // з MobileHeader (проброс — не чіпаємо, але лишаємо для сумісності)
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  runSearch: (q: string) => void;
  searching: boolean;
  hits: { id: string; page: number; snippet: string }[];
  onGoto: (p: number) => void;
  onShare: () => void;
};

export default function MobilePager(p: Props) {
  const { ctrl } = p;

  // ===== 1) Гарантуємо, що рендеримо лише ПОТОЧНУ (і підігріваємо сусідів) =====
  const pageNum = ctrl.currentIndex + 1;
  useEffect(() => {
    // тепер сторінка рендериться on-demand
    try { ctrl.ensureRendered?.(ctrl.currentIndex); } catch {}
    try { ctrl.warmPagesAround?.(ctrl.currentIndex); } catch {}
  }, [ctrl.currentIndex]);

  const bmp = ctrl.cacheRef.current.get(pageNum);

  // ===== 2) Swipe жест (на дотик) =====
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX  = useRef(0);
  const SWIPE_PX = 50; // поріг

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }
  function onTouchEnd() {
    if (touchStartX.current == null) return;
    const dx = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;
    if (Math.abs(dx) < SWIPE_PX) return;
    if (dx < 0 && ctrl.canNext) ctrl.goNext();
    if (dx > 0 && ctrl.canPrev) ctrl.goPrev();
  }

  // ===== 3) Висота: рівно видима зона БЕЗ скролу =====
  // MobileHeader має фіксовану висоту 56px — віднімемо її.
  const headerH = 56;
  // Низ — наш мобільний тулбар ~ 56px (точний розмір ми контролюємо CSSом нижче).
  const footerH = 56;
  const rootStyle: React.CSSProperties = {
    // Вся мобільна частина займає весь екран мінус Header
    height: `calc(100svh - ${headerH}px)`,
    display: "grid",
    gridTemplateRows: `1fr ${footerH}px`,
    background: "#21353a",
  };

  return (
    <div
      ref={ctrl.stageRef}
      className="mpg-root"
      style={rootStyle}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Полотно з однією сторінкою */}
      <div className="mpg-canvas" style={{ display:"grid", placeItems:"center", padding:"10px 10px 12px", overflow:"hidden" }}>
        <div
          className="mpg-page"
          style={{
            width: "100%",
            maxWidth: "980px",
            // ВАЖЛИВО: зберігаємо пропорції сторінки — завжди поміститься по висоті секції
            aspectRatio: ctrl.baseSize.w / ctrl.baseSize.h,
            background: "#fff",
            borderRadius: 4,
            position: "relative",
            overflow: "hidden",
          }}
          onMouseMove={(e) => ctrl.handlePageMouseMove(e, pageNum)}
          onMouseLeave={ctrl.handlePageMouseLeave}
        >
          {bmp ? (
            <>
              <img
                src={bmp.url}
                alt={`p${pageNum}`}
                data-page-img="true"
                draggable={false}
                style={{ width:"100%", height:"100%", objectFit:"contain", display:"block", pointerEvents:"none" }}
              />

              {/* PDF лінки (клікабельні області) */}
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

              {/* Хайлайти пошуку */}
              <div aria-hidden className="hl-layer">
                {(ctrl.pageHighlights?.get?.(pageNum) ?? []).map((r: any, j: number) => {
                  const isActive = typeof r.hitIndex === "number" && r.hitIndex === ctrl.activeHit;
                  return (
                    <div
                      key={j}
                      className={`hl${isActive ? " is-active" : ""}`}
                      style={{
                        position: "absolute",
                        left: `${r.x * 100}%`,
                        top: `${r.y * 100}%`,
                        width: `${r.w * 100}%`,
                        height: `${r.h * 100}%`,
                      }}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ color:"#8aa0a6", display:"grid", placeItems:"center", height:"100%" }}>Рендер сторінки…</div>
          )}
        </div>
      </div>

      {/* Мобільний тулбар */}
      <footer className="mpg-bar">
        <div className="mpg-bar__grid">
          <button className="mpg-btn" onClick={ctrl.goPrev} disabled={!ctrl.canPrev} aria-label="Previous" title="Previous">◀</button>

          <div className="mpg-mid">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              className="mpg-jump"
              value={ctrl.pageJump}
              onChange={(e) => ctrl.setPageJump(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") ctrl.submitJump(); }}
              aria-label="Page"
              title="Enter page"
            />
            <span className="mpg-sep">/</span>
            <strong className="mpg-total">{ctrl.totalPages}</strong>
          </div>

          <button className="mpg-btn" onClick={ctrl.goNext} disabled={!ctrl.canNext} aria-label="Next" title="Next">▶</button>
        </div>
      </footer>

      <style jsx global>{`
        .mpg-root { color:#2d3018; }

        .mpg-bar{
          height:56px;
          background:#ffffffef;
          border-top:1px solid #ecefe7;
          padding:8px;
        }
        .mpg-bar__grid{
          display:grid;
          grid-template-columns:auto 1fr auto;
          gap:8px;
          align-items:center;
          height:100%;
        }
        .mpg-btn{ height:36px; min-width:36px; border:1px solid #e6eadf; border-radius:.6rem; background:#fff; }
        .mpg-btn[disabled]{ opacity:.45; }
        .mpg-mid{ display:flex; justify-content:center; gap:8px; align-items:center; }
        .mpg-jump{ width:72px; text-align:center; height:36px; border:1px solid #e7ebdf; border-radius:.5rem; }
        .mpg-sep{ color:#5c6750; }
        .mpg-total{ color:#2d3018; }

        .pdf-link{ border:0; background:transparent; display:block; }

        .hl{ background:#f4ce6944; outline:1px solid #f4ce69; border-radius:3px; }
        .hl.is-active{ background:#f47e2050; outline-color:#f47e20; }
      `}</style>
    </div>
  );
}
