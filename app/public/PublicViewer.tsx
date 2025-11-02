"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useViewerController } from "../secure/editor/useEditorController";
import EditorHeader from "../secure/editor/EditorHeader";
import ViewerFooter from "../secure/editor/EditorFooter";



// той самий FlipBook
const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

/* --- тип закладки --- */
type Bookmark = { id: string; page: number; label: string; color?: string | null };

/* --- публічний в’ювер з пробросом закладок --- */
export default function PublicViewer({
  file,
  title,
  bookmarks = [],
}: {
  file: string;
  title?: string;
  bookmarks?: { id: string; page: number; label: string; color?: string | null }[];
}) {

  const [error, setError] = useState<string | null>(null);

  let ctrl: ReturnType<typeof useViewerController> | null = null;
  try {
    // контролер не очікує bookmarks — використовуємо їх нижче при рендері
    ctrl = useViewerController({ file, title });
  } catch (err: any) {
    setError(typeof err === "string" ? err : err?.message || "Viewer component error");
  }

  if (!file || typeof file !== "string" || !/^https?:\/\/.+\.pdf(\?.*)?$/i.test(file)) {
    return (
      <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "80px 12px", textAlign: "center" }}>
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>Файл не знайдено або неправильний формат!</h2>
        <div style={{ color: "#aaa", marginTop: 12, fontSize: 16 }}>Передай коректний PDF через публічне посилання.</div>
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
        <h2 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}>Завантаження…</h2>
      </div>
    );
  }



  return (
    <div className="viewer-root">
      <EditorHeader
        title={ctrl.title}
        onSearch={ctrl.runSearch}
        isSearching={(ctrl as any).searching ?? false}
        file={file}
        isFs={ctrl.isFs}
        toggleFullscreen={ctrl.toggleFullscreen}
        handleShare={ctrl.handleShare}
        onPublish={() => {}} // прибито на публічній сторінці
      />

      <section ref={ctrl.stageRef} className="viewer-stage">
        <div
          className={`book-container${ctrl.currentIndex === 0 && !ctrl.single ? " is-cover" : ""}`}
          style={{
            transition: "transform 500ms ease-in-out",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: ctrl.single ? Math.round(ctrl.baseSize.w * ctrl.fitScale) : Math.round(ctrl.baseSize.w * ctrl.fitScale * 2),
            height: Math.round(ctrl.baseSize.h * ctrl.fitScale),
            maxWidth: "100vw",
            maxHeight: "100vh",
            position: "relative",
          }}
        >
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
            style={{
              width: "100%",
              height: "100%",
              minWidth: 0,
              minHeight: 0,
              aspectRatio: ctrl.baseSize.w / ctrl.baseSize.h,
            }}
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
          {/* PAGE IMAGE */}
          <img
            src={bmp.url}
            alt={`p${pageNum}`}
            data-page-img="true"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              borderRadius: 2,
              display: "block",
            }}
          />

          {/* PDF LINKS */}
          {links?.length
            ? links.map((L, idx) =>
                L.href ? (
                  <a
                    key={idx}
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
                    key={idx}
                    className="pdf-link"
                    title="Go to"
                    onClick={() => (L.dest ? (ctrl as any).goToDest?.(L.dest) : null)}
                    style={{
                      position: "absolute",
                      left: `${L.x * 100}%`,
                      top: `${L.y * 100}%`,
                      width: `${L.w * 100}%`,
                      height: `${L.h * 100}%`,
                    }}
                  />
                )
              )
            : null}

          
        </>
      ) : (
        <div style={{ textAlign: "center", lineHeight: "350px", color: "#bbb" }}>
          Рендер сторінки…
        </div>
      )}
    </div>
  );
})}

          </FlipBook>

          {/* === OVERLAY ЗАКЛАДОК (завжди видимі) === */}
{(bookmarks?.length ?? 0) > 0 && (
  <div
    className="bm-tabs-overlay"
    style={{
      position: "absolute",
      inset: 0,
      zIndex: 200,
      overflow: "visible",
      pointerEvents: "none",
      ["--tabThickness" as any]: "36px",
      ["--tabLength" as any]: "140px",
      ["--tabTop" as any]: "36px",
      ["--tabGap" as any]: "0px",
    } as React.CSSProperties}
  >
    {(() => {
      const sorted = [...bookmarks].sort((a, b) => a.page - b.page);

      // поточний розворот
      const leftNow = ctrl!.single
        ? ctrl!.currentIndex + 1
        : (ctrl!.currentIndex % 2 === 0 ? ctrl!.currentIndex + 1 : ctrl!.currentIndex);
      const rightNow = Math.min(leftNow + 1, ctrl!.totalPages);

      return sorted.map((bm, i) => {
        const sideIsLeft = ctrl!.single ? bm.page < (ctrl!.currentIndex + 1) : bm.page < leftNow;

        const baseStyle: React.CSSProperties = {
          position: "absolute",
          top: `calc(var(--tabTop) + ${i} * (var(--tabLength) + var(--tabGap)))`,
          width: "var(--tabThickness)",
          height: "var(--tabLength)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 15,
          fontWeight: 800,
          lineHeight: 1,
          border: "1px solid rgba(0,0,0,.18)",
          boxShadow: "0 2px 6px rgba(0,0,0,.12)",
          opacity: 0.98,
          transition: "transform .18s ease, box-shadow .18s ease, filter .18s ease",
          pointerEvents: "auto",
          background: bm.color || "#f47e20",
          borderRadius: "0 10px 10px 0",
        };

        const sideStyle: React.CSSProperties = sideIsLeft
          ? {
              left: "calc(var(--tabThickness) * -1)",
              transform: "rotate(180deg)",
              transformOrigin: "center",
            }
          : {
              right: "calc(var(--tabThickness) * -1)",
            };

        return (
          <button
            key={bm.id}
            className={`bm-tab ${sideIsLeft ? "left" : "right"}${
              (bm.page === leftNow || bm.page === rightNow) ? " active" : ""
            }`}
            title={`${bm.label} (p.${bm.page})`}
            onClick={(e) => { e.preventDefault(); ctrl!.goToBookmark(bm.id); }}
            style={{ ...baseStyle, ...sideStyle }}
          >
            <span
              className="bm-tab__label"
              style={{
                maxHeight: "calc(var(--tabLength) - 10px)",
                padding: "4px 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                writingMode: "vertical-rl",
                textOrientation: "mixed",
              } as React.CSSProperties}
            >
              {bm.label}
            </span>
          </button>
        );
      });
    })()}
  </div>
)}
{/* === /OVERLAY ЗАКЛАДОК === */}


        </div>
      </section>

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

      <style jsx global>{`
        html, body { margin: 0; height: 100%; background: #21353a; overflow: hidden !important; }
        * { box-sizing: border-box; }
        :root { --hdr: 56px; --ftr: 64px; }
        @media (max-width: 680px) { :root { --hdr: 56px; --ftr: 72px; } }
        .viewer-root { min-height: 100svh; width: 100vw; display: flex; flex-direction: column; color: #fff; background: #21353a; overflow: hidden; }
        .local-header { height: var(--hdr); min-height: var(--hdr); z-index: 120; }
        button[aria-label="Publish"] { display: none !important; }
        .local-footer { height: var(--ftr); min-height: var(--ftr); z-index: 101; }
        .viewer-stage { flex: 1 1 auto; width: 100%; min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .book-container { display:flex; align-items:center; justify-content:center; margin:0 auto; min-width:0; min-height:0; transition: transform 500ms cubic-bezier(.7,0,.2,1); }
        .book-container.is-cover { transform: translateX(-24%); }
        .pdf-link { border:0; background:transparent; cursor:pointer; display:block; }
        .pdf-link:focus-visible { outline:2px dashed rgba(28,121,228,.6); outline-offset:1px; }
        /* Закладка може виходити за межі сторінки FlipBook */
/* щоб елементи могли виходити за межі сторінки */
.page, .page > div, .page .page-content { overflow: visible !important; }
.page .page-content { position: relative; }



/* десь у <style jsx global> PublicViewer */
.bm-tab {
  border: 0;
  cursor: pointer;
}
.bm-tab.active {
  filter: drop-shadow(0 0 6px rgba(255,255,255,.25)) brightness(1.05);
}



@media (max-width: 680px){
  .bm-rail{ width:110px; }
  .bm-tab{ right:8px; min-width:64px; max-width:110px; font-size:11px; padding:5px 8px; }
}
/* === bookmarks styles END === */

      `}</style>
    </div>
  );
}
