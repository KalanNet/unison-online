// components/Viewer.tsx
// Source: migrated from old PublicViewer.tsx / ClientPublicViewer.tsx (flipbook viewer parity)

"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

import { useViewerController } from "app/secure/editor/useEditorController";
import EditorHeader from "app/secure/editor/EditorHeader";
import ViewerFooter from "app/secure/editor/EditorFooter";

// Динамічний імпорт FlipBook (react-pageflip)
const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

export default function Viewer({ file, title }: { file: string; title?: string }) {
  const [error, setError] = useState<string | null>(null);

  let ctrl: ReturnType<typeof useViewerController> | null = null;
  try {
    ctrl = useViewerController({ file, title });
  } catch (err: any) {
    setError(typeof err === "string" ? err : err?.message || "Viewer component error");
  }

  // Базова валідація URL
  if (!file || typeof file !== "string" || !/^https?:\/\/.+\.pdf(\?.*)?$/i.test(file)) {
    return (
      <div
        style={{
          background: "#21353a",
          minHeight: "100vh",
          color: "#fff",
          padding: "80px 12px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>Файл не знайдено або неправильний формат!</h2>
        <div style={{ color: "#aaa", marginTop: 12, fontSize: 16 }}>
          Будь ласка, передайте коректний PDF через upload або URL.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: "#21353a",
          minHeight: "100vh",
          color: "#fff",
          padding: "80px 12px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>Помилка перегляду PDF!</h2>
        <div style={{ color: "#aaa", marginTop: 12 }}>{error}</div>
      </div>
    );
  }

  if (!ctrl || !ctrl.pdfDoc) {
    return (
      <div
        style={{
          background: "#21353a",
          minHeight: "100vh",
          color: "#fff",
          padding: "80px 12px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}>Завантаження Flipbook...</h2>
      </div>
    );
  }

  const page = ctrl.currentIndex + 1;
  const total = ctrl.totalPages;

  return (
    <div
      style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "60px 0 0 0" }}
      className="viewer-root"
    >
      {/* Header — використовуємо існуючий EditorHeader з узгодженими пропсами */}
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

      {/* Сцена FlipBook */}
      <section ref={ctrl.stageRef} style={{ margin: "0 auto", maxWidth: 1060 }}>
        <div className={`book-container${ctrl.currentIndex === 0 && !ctrl.single ? " is-cover" : ""}`}>
          <FlipBook
            ref={ctrl.bookRef}
            width={ctrl.baseSize.w}
            height={ctrl.baseSize.h}
            size="stretch"
            usePortrait={ctrl.single}
            showCover={!ctrl.single}
            flippingTime={600}
            maxShadowOpacity={0.2}
            drawShadow={true}
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
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        pointerEvents: "none",
                        borderRadius: 2,
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", lineHeight: "350px", color: "#bbb" }}>
                      Рендер сторінки...
                    </div>
                  )}
                  {/* TODO: лінки/підсвітка/закладки (за потреби) */}
                </div>
              );
            })}
          </FlipBook>
        </div>
      </section>

      {/* Footer / toolbar */}
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

      {/* Глобальні стилі з контролера */}
      <style jsx global>{ctrl.globalCss}</style>
    </div>
  );
}
