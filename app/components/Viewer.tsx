// app/components/Viewer.tsx
"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useViewerController } from "app/secure/editor/useEditorController";
import EditorHeader from "app/secure/editor/EditorHeader";
import ViewerFooter from "app/secure/editor/EditorFooter";

const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

/* ---------- Допоміжний компонент сторінки з link-layer ---------- */
function PageView(props: {
  ctrl: ReturnType<typeof useViewerController>;
  pageNum: number;
  bmp?: { url: string; w: number; h: number; links?: Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }> };
}) {
  const { ctrl, pageNum, bmp } = props;
  const pageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });

  // Обчислюємо "content box" всередині сторінки з урахуванням object-fit: contain
  useLayoutEffect(() => {
    const host = pageRef.current;
    if (!host) return;

    const img = host.querySelector<HTMLImageElement>("img[data-page-img='true']");
    if (!img || !bmp) return;

    const update = () => {
      const hostRect = host.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Співвідношення зображення та контейнера
      const scale = Math.min(imgRect.width / bmp.w, imgRect.height / bmp.h);
      const contentW = bmp.w * scale;
      const contentH = bmp.h * scale;
      const offsetX = (imgRect.width - contentW) / 2;
      const offsetY = (imgRect.height - contentH) / 2;

      // Координати контент-боксу у системі координат хоста сторінки
      setBox({
        left: imgRect.left - hostRect.left + offsetX,
        top: imgRect.top - hostRect.top + offsetY,
        width: contentW,
        height: contentH,
      });
    };

    const ro = new ResizeObserver(update);
    ro.observe(host);
    ro.observe(img);
    update();

    return () => {
      try {
        ro.disconnect();
      } catch {}
    };
    // fitScale/розміри можуть змінюватись при ресайзі, але ResizeObserver нас і так санує
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bmp?.w, bmp?.h]);

  const links: Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }> = (bmp?.links as any) ?? [];

  return (
    <div
      ref={pageRef}
      style={{
        width: "100%",
        height: "100%",
        background: "#fff",
        position: "relative",
      }}
      onMouseMove={(e) => ctrl!.handlePageMouseMove(e, pageNum)}
      onMouseLeave={ctrl!.handlePageMouseLeave}
    >
      {bmp ? (
        <>
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

          {/* Шар посилань рівно поверх "видимого" зображення (без полів letterbox) */}
          <div
            className="link-layer"
            style={{
              position: "absolute",
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              pointerEvents: "none", // сам шар не перехоплює події
            }}
          >
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
                        pointerEvents: "auto", // саме елементи приймають кліки
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
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                        pointerEvents: "auto",
                      }}
                    />
                  )
                )
              : null}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", lineHeight: "350px", color: "#bbb" }}>Рендер сторінки…</div>
      )}
    </div>
  );
}

export default function Viewer({ file, title }: { file: string; title?: string }) {
  const [error, setError] = useState<string | null>(null);

  let ctrl: ReturnType<typeof useViewerController> | null = null;
  try {
    ctrl = useViewerController({ file, title });
  } catch (err: any) {
    setError(typeof err === "string" ? err : err?.message || "Viewer component error");
  }

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
        <div style={{ color: "#aaa", marginTop: 12, fontSize: 16 }}>Передай коректний PDF через upload або URL.</div>
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
        <h2 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}>Завантаження Flipbook…</h2>
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
        onPublish={(ctrl as any).openPublish ?? (ctrl as any).handlePublish ?? (() => ctrl.handleShare())}
      />

      {/* Сцена між header/footer */}
      <section ref={ctrl.stageRef} className="viewer-stage">
        <div
          className={`book-container${ctrl.currentIndex === 0 && !ctrl.single ? " is-cover" : ""}`}
          style={{
            transition: "transform 500ms ease-in-out",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: ctrl.single
              ? Math.round(ctrl.baseSize.w * ctrl.fitScale)
              : Math.round(ctrl.baseSize.w * ctrl.fitScale * 2),
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
              return <PageView key={i} ctrl={ctrl!} pageNum={pageNum} bmp={bmp} />;
            })}
          </FlipBook>
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

      {/* СТИЛІ */}
      <style jsx global>{`
        html,
        body {
          margin: 0;
          height: 100%;
          background: #21353a;
          overflow: hidden !important;
        }
        * {
          box-sizing: border-box;
        }
        :root {
          --hdr: 56px;
          --ftr: 64px;
        }
        @media (max-width: 680px) {
          :root {
            --hdr: 56px;
            --ftr: 72px;
          }
        }
        .viewer-root {
          min-height: 100svh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          color: #fff;
          background: #21353a;
          overflow: hidden;
        }

        .local-header {
          /* ! Немає position: fixed ! */
          height: var(--hdr);
          min-height: var(--hdr);
          z-index: 120;
        }

        .local-footer {
          /* ! Немає position: fixed ! */
          height: var(--ftr);
          min-height: var(--ftr);
          z-index: 101;
        }

        .viewer-stage {
          flex: 1 1 auto;
          width: 100%;
          min-height: 0;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .book-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          min-width: 0;
          min-height: 0;
          transition: transform 500ms cubic-bezier(.7, 0, .2, 1);
        }
        .book-container.is-cover {
          transform: translateX(-24%);
        }
        @keyframes book-opening {
          0% {
            transform: translateX(-24%);
          }
          100% {
            transform: translateX(0);
          }
        }
        .link-layer {
          /* контейнер для лінків поверх видимої області сторінки */
        }
        .pdf-link {
          border: 0;
          background: transparent;
          cursor: pointer;
          display: block;
        }
        .pdf-link:focus-visible {
          outline: 2px dashed rgba(28, 121, 228, 0.6);
          outline-offset: 1px;
        }
      `}</style>
      <style dangerouslySetInnerHTML={{ __html: ctrl.globalCss }} />
    </div>
  );
}
