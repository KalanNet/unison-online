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

  // щоб не було TS-помилки в PublicViewer.tsx
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
  }, [ctrl.currentIndex, ctrl]);

  const bmp = ctrl.cacheRef.current.get(pageNum);

  // ===== ЗУМ/ПАНОРАМУВАННЯ (локальний стейт) =====
  const pageRef = React.useRef<HTMLDivElement | null>(null);
  const [panEl, setPanEl] = React.useState<HTMLElement | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);

  // щоб MobileSwipe знав про реальний DOM-елемент, а не лише ref
  const pageRefCb = React.useCallback((el: HTMLDivElement | null) => {
    pageRef.current = el;
    setPanEl(el ?? null);
  }, []);

  // Скидання зума при зміні сторінки / пошуку
  useEffect(() => {
    setZoom(1);
    setTx(0);
    setTy(0);
  }, [pageNum, p.searchQuery]);

  // Пінч/пан логіка
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
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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
      setTx((x) => x + e.movementX);
      setTy((y) => y + e.movementY);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) baseDist.current = null;
  };

  // м’які межі пану — щоб картинка не «тікала» за межі
  const maxPan = 180;
  const tX = Math.max(-maxPan, Math.min(maxPan, tx));
  const tY = Math.max(-maxPan, Math.min(maxPan, ty));

  // ===== ЛЕЙАУТ: сцена між хедером і локальним футером =====
  const HEADER_PX = 56; // висота MobileHeader
  const FOOTER_PX = 56; // висота локального футера (панель сторінок)

  const rootStyle: React.CSSProperties = {
    // використовуємо var(--app-h), яку виставляє useEditorController через visualViewport
    height: `calc(var(--app-h, 100dvh) - ${HEADER_PX}px)`,
    display: "grid",
    gridTemplateRows: `1fr ${FOOTER_PX}px`, // канва + футер
    background: "#21353a",
    minHeight: 0, // щоб внутрішній контент не випирав
  };

  return (
    <div className="mpg-root" style={rootStyle}>
      {/* Канва з однією сторінкою */}
      <div
        ref={ctrl.stageRef}
        className="mpg-canvas"
        style={{
          display: "grid",
          placeItems: "center",
          padding: "10px 10px 12px",
          overflow: "hidden",
          minHeight: 0,
          height: "100%", // ключове: канва рівно дорівнює своєму рядку 1fr
        }}
      >
        <MobileSwipe
          key={ctrl.currentIndex}
          onSwipeLeft={ctrl.goNext}
          onSwipeRight={ctrl.goPrev}
          enabled
          panEl={panEl ?? null}
          isZoomed={zoom > 1}
        >
          <div
            ref={pageRefCb}
            className="mpg-page"
            style={{
              // !!! головне виправлення: фіксуємося по ВИСОТІ, а не по ширині
              width: "auto",
              maxWidth: "100%",
              height: "100%",
              maxHeight: "100%",
              aspectRatio: ctrl.baseSize.w / ctrl.baseSize.h,
              background: "#fff",
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
              touchAction: zoom > 1 ? "none" : "pan-y",
              minHeight: 0,
            }}
            onMouseMove={(e) => ctrl.handlePageMouseMove(e, pageNum)}
            onMouseLeave={ctrl.handlePageMouseLeave}
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

                {/* search highlights */}
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
              <div style={{ color: "#e9f0e4", textAlign: "center" }}>
                Loading…
              </div>
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
              onChange={(e) =>
                ctrl.setPageJump(e.target.value.replace(/[^\d]/g, ""))
              }
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
