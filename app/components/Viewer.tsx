// app/components/Viewer.tsx
// Fixed header/footer, full-bleed stage (100% W/H), centered cover, links overlay

"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

import { useViewerController } from "app/secure/editor/useEditorController";
import EditorHeader from "app/secure/editor/EditorHeader";
import EditorFooter from "app/secure/editor/EditorFooter";

// react-pageflip (no SSR)
const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

export default function Viewer({ file, title }: { file: string; title?: string }) {
  const [error, setError] = useState<string | null>(null);

  let ctrl: ReturnType<typeof useViewerController> | null = null;
  try {
    ctrl = useViewerController({ file, title });
  } catch (err: any) {
    setError(typeof err === "string" ? err : err?.message || "Viewer component error");
  }

  // валідація
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

  return (
    <div className="viewer-app">
      {/* FIXED HEADER (тільки title + іконки + Publish) */}
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

      {/* FULL-BLEED STAGE (100% W/H, без відступів) */}
      <main
        ref={ctrl.stageRef}
        className={`stage${ctrl.currentIndex === 0 && !ctrl.single ? " is-cover" : ""}`}
        aria-label="Flipbook stage"
      >
        <div className="book-wrap">
          <FlipBook
            ref={ctrl.bookRef}
            width={ctrl.baseSize.w}
            height={ctrl.baseSize.h}
            size="stretch"
            usePortrait={ctrl.single}
            showCover={!ctrl.single}
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
                      <img
                        src={bmp.url}
                        alt={`p${pageNum}`}
                        data-page-img="true"
                        className="page-img"
                      />
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

      {/* FIXED FOOTER / TOOLBAR */}
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

      {/* LAYOUT CSS */}
      <style jsx global>{`
        /* Глобальний reset + блокування скролу */
        html, body { margin:0; height:100%; overflow:hidden; background:#21353a; }
        * { box-sizing: border-box; }

        :root { --hdr: 56px; --ftr: 64px; }
        @media (max-width: 680px) { :root { --hdr: 56px; --ftr: 72px; } }

        .viewer-app { height:100svh; width:100vw; color:#fff; background:#21353a; }

        /* Fixed header/footer (компоненти вже мають класи, тут — позиціювання) */
        .local-header { position:fixed; top:0; left:0; right:0; z-index:100; }
        .local-footer { position:fixed; bottom:0; left:0; right:0; z-index:90; }

        /* FULL-BLEED STAGE (вся доступна область, без відступів) */
        .stage{
          position:fixed;
          top:var(--hdr);
          bottom:var(--ftr);
          left:0; right:0;
          overflow:hidden;
          display:flex;
          align-items:center;
          justify-content:center;
          /* без падінгів — рівно від хедера до футера і на всю ширину */
        }

        /* Контейнер книги масштабується під stage */
        .book-wrap{
          width:100%;
          height:100%;
          display:flex;
          align-items:center;
          justify-content:center; /* центрує обкладинку */
          max-width: 1400px; /* запобігає розтягуванню на ультрашироких */
          margin:0 auto;
        }

        /* Сторінка всередині FlipBook */
        .page{
          position:relative;
          width:100%;
          height:100%;
          background:#fff;
        }
        .page-img{
          width:100%;
          height:100%;
          object-fit:contain;
          pointer-events:none;
          border-radius:2px;
          display:block;
        }
        .page-loader{ text-align:center; line-height:350px; color:#bbb; }

        /* Клікабельні зони лінків */
        .pdf-link{
          position:absolute;
          border:0; background:transparent;
          cursor:pointer; display:block;
          z-index:3; /* вище за bitmap */
          /* без outline, щоб не спричиняти скрол модальними ефектами */
        }
        .pdf-link:focus-visible{ outline:2px dashed rgba(28,121,228,.6); outline-offset:1px; }

        /* Центрування обкладинки в режимі cover (деякі теми pageflip зміщують вправо) */
        .stage.is-cover .book-wrap{
          justify-content:center;
        }
        /* усуває випадкові субпіксельні скролбари при hover/анім. */
        .stage, .book-wrap { contain: layout paint; }
      `}</style>

      {/* CSS з контролера (рядок) */}
      <style dangerouslySetInnerHTML={{ __html: ctrl.globalCss }} />
    </div>
  );
}
