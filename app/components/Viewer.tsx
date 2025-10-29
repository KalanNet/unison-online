// app/components/Viewer.tsx
// Flipbook viewer with sticky header/footer and responsive stage

"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

import { useViewerController } from "app/secure/editor/useEditorController";
import EditorHeader from "app/secure/editor/EditorHeader";
import ViewerFooter from "app/secure/editor/EditorFooter";

const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

export default function Viewer({ file, title }: { file: string; title?: string }) {
  const [error, setError] = useState<string | null>(null);

  let ctrl: ReturnType<typeof useViewerController> | null = null;
  try {
    ctrl = useViewerController({ file, title });
  } catch (err: any) {
    setError(typeof err === "string" ? err : err?.message || "Viewer component error");
  }

  const Invalid = (
    <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "80px 12px", textAlign: "center" }}>
      <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>Файл не знайдено або неправильний формат!</h2>
      <div style={{ color: "#aaa", marginTop: 12, fontSize: 16 }}>Будь ласка, передайте коректний PDF через upload або URL.</div>
    </div>
  );

  if (!file || typeof file !== "string" || !/^https?:\/\/.+\.pdf(\?.*)?$/i.test(file)) return Invalid;

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
        <h2 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}>Завантаження Flipbook...</h2>
      </div>
    );
  }

  const page = ctrl.currentIndex + 1;
  const total = ctrl.totalPages;

  return (
    <div className="viewer-root">
      {/* STICKY HEADER */}
      <EditorHeader
        title={ctrl.title}
        page={page}
        totalPages={total}
        onPrev={ctrl.goPrev}
        onNext={ctrl.goNext}
        canPrev={ctrl.canPrev}
        canNext={ctrl.canNext}
        searchQuery={ctrl.searchQuery}
        setSearchQuery={ctrl.setSearchQuery}
        runSearch={ctrl.runSearch}
        isFs={ctrl.isFs}
        toggleFullscreen={ctrl.toggleFullscreen}
        handleShare={ctrl.handleShare}
      />

      {/* RESPONSIVE STAGE */}
      <section ref={ctrl.stageRef} className="viewer-stage">
        <div className={`book-outer${ctrl.currentIndex === 0 && !ctrl.single ? " is-cover" : ""}`}>
          <FlipBook
            ref={ctrl.bookRef}
            width={ctrl.baseSize.w}
            height={ctrl.baseSize.h}
            size="stretch"              // FlipBook підлаштовується під розміри контейнера
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
              return (
                <div
                  key={i}
                  style={{ width: "100%", height: "100%", background: "#fff", position: "relative" }}
                  onMouseMove={(e) => ctrl!.handlePageMouseMove(e, pageNum)}
                  onMouseLeave={ctrl!.handlePageMouseLeave}
                >
                  {bmp ? (
                    <img
                      src={bmp.url}
                      alt={`p${pageNum}`}
                      data-page-img="true"
                      style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", borderRadius: 2 }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", lineHeight: "350px", color: "#bbb" }}>Рендер сторінки...</div>
                  )}
                </div>
              );
            })}
          </FlipBook>
        </div>
      </section>

      {/* STICKY FOOTER / TOOLBAR */}
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

      {/* 1) наші layout-стилі як літерал (styled-jsx ok) */}
      <style jsx global>{`
        :root {
          --hdr: 56px;
          --ftr: 64px;
        }

        @media (max-width: 680px) {
          :root {
            --hdr: 60px; /* трішки вищий header на мобільних */
            --ftr: 72px;
          }
        }

        .viewer-root {
          background: #21353a;
          color: #fff;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* sticky елементи використовують спільні класи з header/footer */
        .local-header {
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .local-footer {
          position: sticky;
          bottom: 0;
          z-index: 40;
        }

        /* сцена займає весь простір між header і footer */
        .viewer-stage {
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          /* висота не фіксована — flex сам розраховує між sticky блоками */
        }

        /* контейнер для книги: обмежує ширину і підлаштовує висоту */
        .book-outer {
          width: min(100%, 1060px);
          height: calc(100vh - var(--hdr) - var(--ftr) - 16px); /* 16px = вертикальні padding .viewer-stage */
          display: flex;
        }

        /* коли дуже низьке вікно — не вилазимо за край */
        @media (max-height: 520px) {
          .book-outer {
            height: calc(100vh - var(--hdr) - var(--ftr) - 8px);
          }
        }
      `}</style>

      {/* 2) глобальні стилі з контролера (рядок, тому через dangerouslySetInnerHTML) */}
      <style dangerouslySetInnerHTML={{ __html: ctrl.globalCss }} />
    </div>
  );
}
