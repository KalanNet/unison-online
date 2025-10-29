// app/components/Viewer.tsx
// Sticky header/footer, responsive stage, working pageflip, link overlays

"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

import { useViewerController } from "app/secure/editor/useEditorController";
import EditorHeader from "app/secure/editor/EditorHeader";
import ViewerFooter from "app/secure/editor/EditorFooter";

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

  const page = ctrl.currentIndex + 1;
  const total = ctrl.totalPages;

  return (
    <div className="viewer-root">
      {/* ── STICKY HEADER: лише title + іконки + Publish ───────────────────────── */}
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

      {/* ── STAGE (між sticky header/footer) ──────────────────────────────────── */}
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
              const bmp = ctrl!.cacheRef.current.get(pageNum);
              const links: Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }> =
                (bmp?.links as any) ?? [];

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
                      {/* overlay для клікабельних посилань */}
                      {links?.length
                        ? links.map((L, idx) => {
                            // L-координати вже у відносних px під розмір рендеру
                            return L.href ? (
                              <a
                                key={idx}
                                href={L.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pdf-link"
                                style={{
                                  position: "absolute",
                                  left: L.x,
                                  top: L.y,
                                  width: L.w,
                                  height: L.h,
                                }}
                              />
                            ) : (
                              // внутрішня навігація по PDF
                              <button
                                key={idx}
                                className="pdf-link"
                                title="Go to"
                                onClick={() => (L.dest ? (ctrl as any).goToDest?.(L.dest) : null)}
                                style={{
                                  position: "absolute",
                                  left: L.x,
                                  top: L.y,
                                  width: L.w,
                                  height: L.h,
                                }}
                              />
                            );
                          })
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

      {/* ── STICKY FOOTER / TOOLBAR ──────────────────────────────────────────── */}
      <ViewerFooter
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

      {/* ── Layout CSS + reset ───────────────────────────────────────────────── */}
      <style jsx global>{`
        /* reset + fix top/bottom gaps */
        html, body { margin: 0; height: 100%; background: #21353a; }
        * { box-sizing: border-box; }

        :root {
          --hdr: 56px;
          --ftr: 64px;
        }
        @media (max-width: 680px) {
          :root { --hdr: 56px; --ftr: 72px; }
        }

        .viewer-root {
          min-height: 100svh; /* мобільні без адресбару */
          display: flex;
          flex-direction: column;
          color: #fff;
          background: #21353a;
        }

        /* sticky */
        .local-header { position: sticky; top: 0; z-index: 50; }
        .local-footer { position: sticky; bottom: 0; z-index: 40; }

        /* сцена між ними */
        .viewer-stage {
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
        }

        .book-outer {
          width: min(100%, 1060px);
          height: calc(100svh - var(--hdr) - var(--ftr) - 16px);
          display: flex;
        }

        /* клікабельні зони посилань */
        .pdf-link {
          border: 0;
          background: transparent;
          cursor: pointer;
          display: block;
        }
        .pdf-link:focus-visible { outline: 2px dashed rgba(28,121,228,.6); outline-offset: 1px; }
      `}</style>

      {/* ctrl.globalCss — це уже готовий CSS-текст з контролера */
      /* styled-jsx дозволяє <style> з literal; тут — без jsx, бо це plain string */}
      <style dangerouslySetInnerHTML={{ __html: ctrl.globalCss }} />
    </div>
  );
}
