"use client";

import React, { useEffect, useMemo, useRef } from "react";

// Тип ctrl узятий із вашого useViewerController (нічого не імпортуємо — приймаємо як any)
type Ctrl = any;

type Props = {
  ctrl: Ctrl;
  file: string;
  title?: string;
  // з MobileHeader
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

  // Поточна сторінка (1-based) і її bmp з кешу контролера
  const pageNum = ctrl.currentIndex + 1;
  const bmp = ctrl.cacheRef.current.get(pageNum);

  // Підігріваємо сусідів для плавності свайпів
  useEffect(() => {
    try { ctrl.warmPagesAround?.(ctrl.currentIndex); } catch {}
  }, [ctrl.currentIndex]);

  return (
    <div
      ref={ctrl.stageRef}
      className="mpg-root"
      onTouchStartCapture={() => {}}
      style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: "100svh", background: "#21353a" }}
    >
      {/* Саме полотно з однією сторінкою */}
      <div className="mpg-canvas" style={{ display: "grid", placeItems: "center", padding: "10px 10px 12px" }}>
        <div
          className="mpg-page"
          style={{
            width: "100%",
            maxWidth: "980px",
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
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
              />

              {/* Клікабельні PDF-лінки */}
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
            <div style={{ color: "#8aa0a6", display: "grid", placeItems: "center", height: "100%" }}>Рендер сторінки…</div>
          )}
        </div>
      </div>

      {/* Невеликий мобільний тулбар */}
      <footer className="mpg-bar" style={{ background: "#ffffffef", borderTop: "1px solid #ecefe7", padding: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
          <button
            className="mpg-btn"
            onClick={ctrl.goPrev}
            disabled={!ctrl.canPrev}
            aria-label="Previous"
            title="Previous"
          >
            ◀
          </button>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
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
            <span style={{ color: "#5c6750" }}>/</span>
            <strong style={{ color: "#2d3018" }}>{ctrl.totalPages}</strong>
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
        .mpg-root { color:#2d3018; }
        .mpg-btn { height:36px; min-width:36px; border:1px solid #e6eadf; border-radius:.6rem; background:#fff; }
        .mpg-btn[disabled]{ opacity:.45; }
        .mpg-jump { width:72px; text-align:center; height:36px; border:1px solid #e7ebdf; border-radius:.5rem; }
        .hl { background: #f4ce6944; outline: 1px solid #f4ce69; border-radius: 3px; }
        .hl.is-active { background: #f47e2050; outline-color:#f47e20; }
      `}</style>
    </div>
  );
}
