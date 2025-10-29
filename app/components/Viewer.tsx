// app/components/Viewer.tsx
// Fixed header/footer, full-bleed stage, responsive FlipBook sized by stage,
// centered cover on page 1, link overlays, no scrollbars.

"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { useViewerController } from "app/secure/editor/useEditorController";
import EditorHeader from "app/secure/editor/EditorHeader";
import EditorFooter from "app/secure/editor/EditorFooter";

// react-pageflip (no SSR)
const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

type BookSize = { w: number; h: number };

export default function Viewer({ file, title }: { file: string; title?: string }) {
  const [error, setError] = useState<string | null>(null);

  let ctrl: ReturnType<typeof useViewerController> | null = null;
  try {
    ctrl = useViewerController({ file, title });
  } catch (err: any) {
    setError(typeof err === "string" ? err : err?.message || "Viewer component error");
  }

  // ---- guards
  if (!file || typeof file !== "string" || !/^https?:\/\/.+\.pdf(\?.*)?$/i.test(file)) {
    return (
      <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "80px 12px", textAlign: "center" }}>
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>Файл не знайдено або неправильний формат!</h2>
        <div style={{ color: "#aaa", marginTop: 12, fontSize: 16 }}>Передай коректний PDF через upload або URL.</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "80px 12px", textAlign: "center" }}>
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>Помилка перегляду PDF!</h2>
        <div style={{ color: "#aaa", marginTop: 12 }}>{error}</div>
      </div>
    );
  }
  if (!ctrl || !ctrl.pdfDoc) {
    return (
      <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "80px 12px", textAlign: "center" }}>
        <h2 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}>Завантаження Flipbook…</h2>
      </div>
    );
  }

  // ============= Responsive sizing driven by STAGE =============
  // base page aspect (single page)
  const pageRatio = ctrl.baseSize.w / ctrl.baseSize.h || 0.707; // ~A4 fallback

  // size computed from stage rect
  const [bookSize, setBookSize] = useState<BookSize>(() => ({ w: ctrl.baseSize.w, h: ctrl.baseSize.h }));
  const stageEl = useRef<HTMLElement | null>(null);

  // expose ctrl.stageRef -> also store as local ref
  const setStageRef = (node: HTMLElement | null) => {
    stageEl.current = node;
    if (node) (ctrl!.stageRef as any).current = node;
  };

  useLayoutEffect(() => {
    if (!stageEl.current) return;

    const ro = new ResizeObserver(() => {
      const el = stageEl.current!;
      const cw = el.clientWidth;
      const ch = el.clientHeight;

      // desired aspect: single page OR spread (two pages next to each other)
      const isSpread = !ctrl!.single && ctrl!.currentIndex > 0; // after page 1
      const desiredRatio = isSpread ? pageRatio * 2 : pageRatio;

      // fit-to-contain: max area fitting into stage
      let width = cw;
      let height = Math.floor(cw / desiredRatio);
      if (height > ch) {
        height = ch;
        width = Math.floor(ch * desiredRatio);
      }

      // protect from zeros
      const w = Math.max(200, Math.floor(width));
      const h = Math.max(200, Math.floor(height));
      setBookSize((prev) => (prev.w !== w || prev.h !== h ? { w, h } : prev));
    });

    ro.observe(stageEl.current);
    return () => ro.disconnect();
  }, [ctrl?.single, ctrl?.currentIndex, pageRatio]);

  // Center cover: first page centered as single; when move to page > 0, spread.
  const showCover = !ctrl.single && ctrl.currentIndex > 0; // only after leaving the cover

  return (
    <div className="viewer-app">
      {/* HEADER (fixed; title + icons + Publish) */}
      <EditorHeader
        title={ctrl.title}
        onSearch={(q) => ctrl!.runSearch(q)}
        isSearching={(ctrl as any).searching ?? false}
        file={file}
        isFs={ctrl.isFs}
        toggleFullscreen={ctrl.toggleFullscreen}
        handleShare={ctrl.handleShare}
        onPublish={(ctrl as any).openPublish ?? (ctrl as any).handlePublish ?? (() => ctrl!.handleShare())}
      />

      {/* FULL-BLEED STAGE (no padding; owns the sizing) */}
      <main ref={setStageRef} className={`stage${ctrl.currentIndex === 0 ? " is-cover" : ""}`} aria-label="Flipbook stage">
        <div className="book-wrap" style={{ width: bookSize.w, height: bookSize.h }}>
          <FlipBook
            ref={ctrl.bookRef}
            width={bookSize.w}
            height={bookSize.h}
            size="fixed"               // we pass exact w/h computed from stage
            usePortrait={ctrl.single || ctrl.currentIndex === 0}
            showCover={showCover}
            flippingTime={600}
            maxShadowOpacity={0.2}
            drawShadow
            mobileScrollSupport
            startPage={ctrl.currentIndex}
            onFlip={(e: { data: number }) => ctrl!.setCurrentIndex(e.data)}
          >
            {Array.from({ length: ctrl.totalPages }).map((_, i) => {
              const pageNum = i + 1;
              const bmp = ctrl!.cacheRef.current.get(pageNum);
              const links: Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }> =
                (bmp?.links as any) ?? [];

              return (
                <div
                  key={i}
                  className="page"
                  onMouseMove={(e) => ctrl!.handlePageMouseMove(e, pageNum)}
                  onMouseLeave={ctrl!.handlePageMouseLeave}
                >
                  {bmp ? (
                    <>
                      <img src={bmp.url} alt={`p${pageNum}`} data-page-img="true" className="page-img" />
                      {links.length
                        ? links.map((L, idx) =>
                            L.href ? (
                              <a
                                key={idx}
                                href={L.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pdf-link"
                                style={{ left: L.x, top: L.y, width: L.w, height: L.h }}
                              />
                            ) : (
                              <button
                                key={idx}
                                className="pdf-link"
                                title="Go to"
                                onClick={() => (L.dest ? (ctrl as any).goToDest?.(L.dest) : null)}
                                style={{ left: L.x, top: L.y, width: L.w, height: L.h }}
                              />
                            )
                          )
                        : null}
                    </>
                  ) : (
                    <div className="page-loader">Рендер сторінки…</div>
                  )}
                </div>
              );
            })}
          </FlipBook>
        </div>
      </main>

      {/* FOOTER / TOOLBAR (fixed) */}
      <EditorFooter
        refEl={ctrl.toolbarRef}
        isNarrow={ctrl.isNarrow}
        numPages={ctrl.totalPages}
        currentIndex={ctrl.currentIndex}
        canPrev={ctrl.canPrev}
        canNext={ctrl.canNext}
        goFirst={ctrl.goFirst}
        goPrev={ctrl.goPrev}
        goNext={ctrl.goNext}
        goLast={ctrl.goLast}
        pageJump={ctrl.pageJump}
        setPageJump={ctrl.setPageJump}
        submitJump={ctrl.submitJump}
        loupeOn={ctrl.loupeOn}
        setLoupeOn={ctrl.setLoupeOn}
        loupeState={ctrl.loupe}
        LOUPE_SIZE={ctrl.LOUPE_SIZE}
        LOUPE_ZOOM={ctrl.LOUPE_ZOOM}
      />

      {/* Layout CSS */}
      <style jsx global>{`
        /* Hard lock global scroll; we manage everything inside stage */
        html, body { margin: 0; height: 100%; overflow: hidden; background: #21353a; }
        * { box-sizing: border-box; }

        :root { --hdr: 56px; --ftr: 64px; }
        @media (max-width: 680px) { :root { --hdr: 56px; --ftr: 72px; } }

        .viewer-app { height: 100svh; width: 100vw; color: #fff; background: #21353a; }

        /* fixed header/footer */
        .local-header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; }
        .local-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 90; }

        /* stage occupies exactly the space between them */
        .stage {
          position: fixed;
          top: var(--hdr);
          bottom: var(--ftr);
          left: 0; right: 0;
          overflow: hidden;
          display: grid;
          place-items: center;     /* keeps cover perfectly centered */
          background: #21353a;
          contain: strict;         /* prevents hover jitters / scrollbars */
        }

        /* book container gets exact computed size; no padding, no gaps */
        .book-wrap {
          display: grid;
          place-items: center;
          will-change: width, height;
        }

        .page { position: relative; width: 100%; height: 100%; background: #fff; }
        .page-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          pointer-events: none;
          border-radius: 2px;
        }
        .page-loader { text-align: center; line-height: 350px; color: #bbb; }

        /* click areas for links */
        .pdf-link {
          position: absolute;
          border: 0;
          background: transparent;
          cursor: pointer;
          display: block;
          z-index: 3;
        }
        .pdf-link:focus-visible { outline: 2px dashed rgba(28,121,228,.6); outline-offset: 1px; }
      `}</style>

      {/* controller CSS (string) */}
      <style dangerouslySetInnerHTML={{ __html: ctrl.globalCss }} />
    </div>
  );
}
