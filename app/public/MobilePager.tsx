"use client";

import React, { useEffect } from "react";
import MobileSwipe from "./MobileSwipe";

type Ctrl = any;

type Props = {
  ctrl: Ctrl;
  file: string;
  title?: string;

  // з MobileHeader (проброс — лишаємо для сумісності)
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

  // ===== 1) Рендеримо лише поточну та підігріваємо сусідів =====
  const pageNum = ctrl.currentIndex + 1;
  useEffect(() => {
    try { ctrl.ensureRendered?.(ctrl.currentIndex); } catch {}
    try { ctrl.warmPagesAround?.(ctrl.currentIndex); } catch {}
  }, [ctrl.currentIndex]);

  const bmp = ctrl.cacheRef.current.get(pageNum);

  // === Зум + панорамування сторінки (стейт на рівні MobilePager) ===
const pageRef = React.useRef<HTMLDivElement>(null);

const [zoom, setZoom] = React.useState(1);
const [tx, setTx] = React.useState(0);
const [ty, setTy] = React.useState(0);

// double-tap
const lastTapRef = React.useRef(0);
const onTap = () => {
  const now = Date.now();
  if (now - lastTapRef.current < 260) {
    setZoom(z => (z === 1 ? 2 : 1));
    if (zoom !== 1) { setTx(0); setTy(0); } // скинути пан при відзумі
  }
  lastTapRef.current = now;
};

// pinch-to-zoom (pointer)
const pts = React.useRef<Map<number, {x:number,y:number}>>(new Map());
const baseDist = React.useRef<number | null>(null);
const baseZoom = React.useRef(1);

function dist() {
  const a = [...pts.current.values()];
  if (a.length < 2) return 0;
  const [p1, p2] = a; const dx = p1.x - p2.x, dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

const onPointerDown = (e: React.PointerEvent) => {
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.current.size === 2) {
    baseDist.current = dist();
    baseZoom.current = zoom;
  }
};
const onPointerMove = (e: React.PointerEvent) => {
  if (!pts.current.has(e.pointerId)) return;
  pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pts.current.size === 2 && baseDist.current) {
    const ratio = dist() / baseDist.current;
    const next = Math.min(4, Math.max(1, baseZoom.current * ratio));
    setZoom(next);
  } else if (pts.current.size === 1 && zoom > 1) {
    setTx(x => x + e.movementX);
    setTy(y => y + e.movementY);
  }
};
const onPointerUp = (e: React.PointerEvent) => {
  pts.current.delete(e.pointerId);
  if (pts.current.size < 2) baseDist.current = null;
};

// обмеження пана (м’які межі)
const maxPan = 180;
const tX = Math.max(-maxPan, Math.min(maxPan, tx));
const tY = Math.max(-maxPan, Math.min(maxPan, ty));


  // ===== 2) Висота: рівно видима зона без скролу сторінки =====
const footerPx = 56;
const rootStyle: React.CSSProperties = {
  height: `100dvh`,                 // ← стабільна висота екрана на мобільних
  display: "grid",
  gridTemplateRows: `1fr ${footerPx}px`,
  background: "#21353a"
};

  return (
    <div
      ref={ctrl.stageRef}
      className="mpg-root"
      style={rootStyle}
    >
      {/* Полотно з ОДНІЄЮ сторінкою */}
<div
  className="mpg-canvas"
  style={{ display: "grid", placeItems: "center", padding: "10px 10px 12px", overflow: "hidden" }}
>
  <MobileSwipe
    key={ctrl.currentIndex}                       // анти-«залипання» після переходів
    onSwipeLeft={() => ctrl.canNext && ctrl.goNext()}
    onSwipeRight={() => ctrl.canPrev && ctrl.goPrev()}
    threshold={80}
    panEl={pageRef.current}                       // ← даємо MobileSwipe “панель” для детекту зуму
    isZoomed={zoom > 1}                           // ← явний прапорець, коли зум увімкнено
  >
    <div
      ref={pageRef}
      className="mpg-page"
      style={{
        width: "100%",
        maxWidth: "980px",
        aspectRatio: ctrl.baseSize.w / ctrl.baseSize.h,
        background: "#fff",
        borderRadius: 4,
        position: "relative",
        overflow: "auto",                         // при зумі контент більший — з’являється пан
        touchAction: zoom > 1 ? "none" : "pan-y", // зум → жести всередині; без зуму → свайп бере кермо
      }}
      onMouseMove={(e) => ctrl.handlePageMouseMove(e, pageNum)}
      onMouseLeave={ctrl.handlePageMouseLeave}
      onClick={onTap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {bmp ? (
        <>
          <img
            src={bmp.url}
            alt={`p${pageNum}`}
            data-page-img="true"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              pointerEvents: "none",
              transform: `translate3d(${tX}px, ${tY}px, 0) scale(${zoom})`,
              transformOrigin: "center center",
              willChange: "transform",
              transition: zoom === 1 ? "transform 180ms ease-out" : "none",
            }}
          />

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
        <div style={{ color: "#8aa0a6", display: "grid", placeItems: "center", height: "100%" }}>
          Рендер сторінки…
        </div>
      )}
    </div>
  </MobileSwipe>
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
