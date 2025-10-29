// app/components/Viewer.tsx
// Fixed header/footer, centered cover with old is-cover trick, working links & flip animation

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

  // базова перевірка
  if (!file || typeof file !== "string" || !/^https?:\/\/.+\.pdf(\?.*)?$/i.test(file)) {
    return (
      <div className="viewer-fallback">
        <h2>Файл не знайдено або неправильний формат!</h2>
        <div>Передай коректний PDF через upload або URL.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-fallback">
        <h2>Помилка перегляду PDF!</h2>
        <div>{error}</div>
      </div>
    );
  }

  if (!ctrl || !ctrl.pdfDoc) {
    return (
      <div className="viewer-fallback">
        <h2>Завантаження Flipbook…</h2>
      </div>
    );
  }

  const linksFor = (pageNum: number) => {
    const bmp = ctrl!.cacheRef.current.get(pageNum);
    return {
      bmp,
      links: ((bmp?.links as any) ?? []) as Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }>,
    };
  };

  return (
    <div className="viewer-root">
      {/* FIXED HEADER (без ніяких sticky) */}
      <div className="fixed-header">
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
      </div>

      {/* Сцена рівно між fixed header/footer */}
      <section ref={ctrl.stageRef} className="viewer-stage">
        <div className={`book-outer${ctrl.currentIndex === 0 && !ctrl.single ? " is-cover" : ""}`}>
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
              const { bmp, links } = linksFor(pageNum);
              return (
                <div
                  key={i}
                  style={{ width: "100%", height: "100%", background: "#fff", position: "relative" }}
                  onMouseMove={(e) => ctrl!.handlePageMouseMove(e, pageNum)}
                  onMouseLeave={ctrl!.handlePageMouseLeave}
                >
                  {bmp ? (
                    <>
                      <img
                        src={bmp.url}
                        alt={`p${pageNum}`}
                        data-page-img="true"
                        style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", borderRadius: 2 }}
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
                    <div style={{ textAlign: "center", lineHeight: "350px", color: "#bbb" }}>Рендер сторінки…</div>
                  )}
                </div>
              );
            })}
          </FlipBook>
        </div>
      </section>

      {/* FIXED FOOTER (без sticky) */}
      <div className="fixed-footer">
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
      </div>

      {/* Layout/CSS */}
      <style jsx global>{`
        html, body { margin: 0; background:#21353a; }
        html { scrollbar-gutter: stable both-edges; }
        * { box-sizing: border-box; }

        :root {
          --hdr: 56px;
          --ftr: 64px;
        }
        @media (max-width: 680px) {
          :root { --hdr: 56px; --ftr: 72px; }
        }

        .viewer-root {
          min-height: 100vh;
          color: #fff;
          background: #21353a;
        }

        .fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 50; }
        .fixed-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 40; }

        .viewer-stage {
          /* рівно між fixed header/footer */
          padding-top: var(--hdr);
          padding-bottom: var(--ftr);
          min-height: calc(100vh - var(--hdr) - var(--ftr));
          display: grid;
          place-items: center;
        }

        .book-outer {
          width: min(100%, 1060px);
          height: calc(100vh - var(--hdr) - var(--ftr));
          display: flex;
        }

        /* Центрована обкладинка — як у старому проекті: контейнер з модифікатором is-cover */
        .book-outer.is-cover {
          /* не даємо лівій «порожній» сторінці з'являтись: першу сторінку вирівнюємо по центру */
        }
        .book-outer.is-cover .page {
          margin-left: auto !important;
          margin-right: auto !important;
          left: 0 !important;
          transform: none !important;
        }

        /* overlay клікабельних лінків над зображенням */
        .pdf-link {
          position: absolute;
          z-index: 3;
          border: 0;
          background: transparent;
          cursor: pointer;
          display: block;
          pointer-events: auto;
        }
        .pdf-link:focus-visible { outline: 2px dashed rgba(28,121,228,.6); outline-offset: 1px; }

        /* fallback blocks */
        .viewer-fallback {
          background:#21353a; min-height:100vh; color:#fff;
          padding:80px 12px; text-align:center;
        }
        .viewer-fallback h2 { color:#f4ce69; font-weight:900; font-size:22px; }
      `}</style>

      {/* Глобальний CSS з контролера (оригінальні стилі flipbook, включаючи анімацію) */}
      <style dangerouslySetInnerHTML={{ __html: ctrl.globalCss }} />
    </div>
  );
}
