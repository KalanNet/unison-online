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

  // опціонально з PublicViewer
  onShare?: () => void;
};

export default function MobilePager(p: Props) {
  const { ctrl } = p;

  const pageNum = ctrl.currentIndex + 1;

  useEffect(() => {
    try {
      // прогрів близьких сторінок
      ctrl.warmPagesAround?.(ctrl.currentIndex);
    } catch {}
  }, [ctrl.currentIndex, ctrl]);

  const bmp = ctrl.cacheRef.current.get(pageNum);

  // ===== ЗУМ/ПАН (локально) =====
  const pageRef = React.useRef<HTMLDivElement | null>(null);
  const [panEl, setPanEl] = React.useState<HTMLElement | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);

  const pageRefCb = React.useCallback((el: HTMLDivElement | null) => {
    pageRef.current = el;
    setPanEl(el ?? null);
  }, []);

  // обчислення максимально допустимого зсуву для поточного масштабу
  function getMaxPan(zoomNow: number) {
    const el = pageRef.current;
    if (!el) return { maxX: 0, maxY: 0 };
    // зображення вписане в контейнер (object-fit: contain),
    // базовий розмір контенту = розміру контейнера
    const baseW = el.clientWidth;
    const baseH = el.clientHeight;
    const extraW = Math.max(0, baseW * zoomNow - baseW);
    const extraH = Math.max(0, baseH * zoomNow - baseH);
    return { maxX: extraW / 2, maxY: extraH / 2 };
  }

  // Коли змінилась сторінка або пошуковий запит — скинути зум/пан
  useEffect(() => {
    setZoom(1);
    setTx(0);
    setTy(0);
  }, [pageNum, p.searchQuery]);

  // При зміні zoom — притиснути tx/ty і автоцентрувати коли ≈1
  useEffect(() => {
    const { maxX, maxY } = getMaxPan(zoom);
    setTx((x) => Math.min(maxX, Math.max(-maxX, x)));
    setTy((y) => Math.min(maxY, Math.max(-maxY, y)));
    if (zoom <= 1.001) {
      setTx(0);
      setTy(0);
    }
  }, [zoom]);

  // === Touch-події без movementX/movementY ===
  const pts = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const baseDist = React.useRef<number | null>(null);
  const baseZoom = React.useRef(1);

  const dist = () => {
    const arr = Array.from(pts.current.values());
    if (arr.length < 2) return 0;
    const [a, b] = arr;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); // ← тут
  pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.current.size === 2) {
    baseDist.current = dist();
    baseZoom.current = zoom;
  }
};

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;

    const prev = pts.current.get(e.pointerId)!;
    const curr = { x: e.clientX, y: e.clientY };
    pts.current.set(e.pointerId, curr);

    if (pts.current.size === 2 && baseDist.current) {
      const ratio = dist() / baseDist.current;
      const next = Math.min(4, Math.max(1, baseZoom.current * ratio));
      setZoom(next);
    } else if (pts.current.size === 1 && zoom > 1) {
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const { maxX, maxY } = getMaxPan(zoom);
      setTx((x) => Math.min(maxX, Math.max(-maxX, x + dx)));
      setTy((y) => Math.min(maxY, Math.max(-maxY, y + dy)));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); // ← тут
  pts.current.delete(e.pointerId);
  if (pts.current.size < 2) baseDist.current = null;
  if (zoom <= 1.001) { setZoom(1); setTx(0); setTy(0); }
  else {
    const { maxX, maxY } = getMaxPan(zoom);
    setTx((x) => Math.min(maxX, Math.max(-maxX, x)));
    setTy((y) => Math.min(maxY, Math.max(-maxY, y)));
  }
};

  // Кламп у рендері по реальних межах (без магічних чисел)
  const { maxX: clampX, maxY: clampY } = getMaxPan(zoom);
  const tX = Math.max(-clampX, Math.min(clampX, tx));
  const tY = Math.max(-clampY, Math.min(clampY, ty));

  // ===== ЛЕЙАУТ: 1fr (канва) + 56px (футер) =====
  const HEADER_PX = 56;
  const FOOTER_PX = 56;

  const rootStyle: React.CSSProperties = {
    height: `calc(var(--app-h, 100dvh) - ${HEADER_PX}px)`,
    display: "grid",
    gridTemplateRows: `1fr ${FOOTER_PX}px`,
    background: "#21353a",
    minHeight: 0,
    overflow: "hidden",
  };

  return (
    <div className="mpg-root" style={rootStyle}>
      {/* Канва */}
      <div
        ref={ctrl.stageRef}
        className="mpg-canvas"
        style={{
          height: "100%",
          minHeight: 0,
          display: "grid",
          placeItems: "center",
          padding: "10px 10px 12px",
          overflow: "hidden",
        }}
      >
        <MobileSwipe
  key={pageNum}
  onSwipeLeft={ctrl.goNext}
  onSwipeRight={ctrl.goPrev}
  enabled
  panEl={panEl ?? null}
  isZoomed={zoom > 1.001} // ← так
>

          <div
            ref={pageRefCb}
            className="mpg-page"
            onMouseMove={(e) => ctrl.handlePageMouseMove(e, pageNum)}
            onMouseLeave={ctrl.handlePageMouseLeave}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              height: "100%",
              maxHeight: "100%",
              width: "auto",
              maxWidth: "100%",
              aspectRatio: ctrl.baseSize.w / ctrl.baseSize.h,
              display: "grid",
              placeItems: "center",
              background: "#fff",
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
              touchAction: zoom > 1 ? "none" : "pan-y",
              minHeight: 0,
            }}
          >
            {bmp ? (
              <>
                <img
                  src={bmp.url}
                  alt={`Page ${pageNum}`}
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
                    transition: zoom <= 1.001 ? "transform 200ms ease-out" : "none",
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
                      onClick={() =>
                        L.dest ? (ctrl as any).goToDest?.(L.dest) : null
                      }
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

                {/* Search highlights */}
                <div className="mpg-hl-layer">
                  {(((ctrl as any).pageHighlights?.get?.(pageNum)) ?? []).map(
                    (hl: any, i: number) => {
                      const isActive =
                        typeof hl.hitIndex === "number" &&
                        hl.hitIndex === (ctrl as any).activeHit;
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
                    }
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: "#e9f0e4", textAlign: "center" }}>Loading…</div>
            )}
          </div>
        </MobileSwipe>
      </div>

      {/* МОБІЛЬНИЙ ФУТЕР */}
      <footer className="mpg-bar" aria-label="Mobile pager controls">
        <div className="mpg-bar__grid">
          {/* first page */}
          <button
            className="mpg-btn"
            onClick={ctrl.goFirst}
            disabled={!ctrl.canPrev}
            aria-label="First page"
            title="First page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 5v14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M18 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>

          {/* prev */}
          <button
            className="mpg-btn"
            onClick={ctrl.goPrev}
            disabled={!ctrl.canPrev}
            aria-label="Previous page"
            title="Previous"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>

          {/* центр з інпутом */}
          <div className="mpg-mid">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              className="mpg-jump"
              value={ctrl.pageJump}
              onChange={(e) =>
                ctrl.setPageJump(e.target.value.replace(/[^\d]/g, ""))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") ctrl.submitJump();
              }}
              aria-label="Page number"
              title="Enter page number"
            />
            <span className="mpg-sep">/</span>
            <span className="mpg-total">{ctrl.totalPages || "…"}</span>
          </div>

          {/* next */}
          <button
            className="mpg-btn"
            onClick={ctrl.goNext}
            disabled={!ctrl.canNext}
            aria-label="Next page"
            title="Next"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>

          {/* last page */}
          <button
            className="mpg-btn"
            onClick={ctrl.goLast}
            disabled={!ctrl.canNext}
            aria-label="Last page"
            title="Last page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M18 5v14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M6 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
      </footer>

      {/* Мінімальні глобальні стилі для стабільного макета */}
      <style jsx global>{`
        .mpg-root {
          color: #2d3018;
        }
        .mpg-canvas {
          height: 100%;
        }

        .mpg-bar {
          height: 56px;
          background: #ffffffef;
          border-top: 1px solid #ecefe7;
          padding: 8px;
        }
        .mpg-bar__grid {
          display: grid;
          grid-template-columns: auto auto 1fr auto auto;
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
          display: inline-grid;
          place-items: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
          color: #2d3018;
        }
        .mpg-btn svg {
          display: block;
        }
        .mpg-btn[disabled] {
          opacity: 0.45;
          cursor: not-allowed;
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
          font-weight: 700;
          color: #2d3018;
          background: #fff;
        }
        .mpg-sep {
          color: #5c6750;
        }
        .mpg-total {
          color: #2d3018;
          font-weight: 700;
        }

        .pdf-link {
          border: 0;
          background: transparent;
          display: block;
        }
        .mpg-hl-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
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
