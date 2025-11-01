// app/components/Viewer.tsx
"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useViewerController } from "app/secure/editor/useEditorController";
import EditorHeader from "app/secure/editor/EditorHeader";
import ViewerFooter from "app/secure/editor/EditorFooter";

const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

/* helper: slugify for client field (сервер все одно перевіряє) */
function slugify(input: string): string {
  return (input || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
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

  /* брендова палітра для закладок */
  const brandColors = ["#f47e20","#00647b","#54c2bb","#ac1f23","#6b7034","#fff4e7","#eeece8","#bdcbdb","#4e667a","#2d3018"];

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
        onPublish={ctrl.publishMetaAndBookmarks}
      />

      {/* Стікі панель зліва (overlay, не впливає на контейнери) */}
      <aside className="fb-sticky-panel" role="complementary" aria-label="Bookmarks & Meta">
        <div className="fb-panel-sec">
          <div className="fb-sec-h">Meta</div>

          <label className="fb-field">
            <div className="fb-lab">Title</div>
            <input
              className="fb-inp"
              value={ctrl.meta.title}
              onChange={(e) => {
                const v = e.target.value;
                // якщо slug порожній — автогенерація зі зміненого title
                if (!ctrl.meta.slug || ctrl.meta.slug.length === 0) {
                  ctrl.setMeta({ title: v, slug: slugify(v) as any });
                } else {
                  ctrl.setMeta({ title: v });
                }
              }}
            />
          </label>

          <label className="fb-field">
            <div className="fb-lab">Meta description</div>
            <textarea
              className="fb-txt"
              rows={3}
              value={ctrl.meta.description}
              onChange={(e) => ctrl.setMeta({ description: e.target.value })}
            />
          </label>

          <label className="fb-field">
            <div className="fb-lab">Slug</div>
            <input
              className="fb-inp"
              value={ctrl.meta.slug ?? ""}
              onChange={(e) => ctrl.setMeta({ slug: slugify(e.target.value) as any })}
              placeholder="auto-from-title"
            />
          </label>

          <div className="fb-field">
            <div className="fb-lab">Featured image</div>
            <div className="fb-row">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const fd = new FormData(); fd.append("image", f);
                  const res = await fetch("/api/upload-featured", { method: "POST", body: fd });
                  const out = await res.json();
                  if (out?.url) ctrl.setFeatured(out.url);
                }}
              />
            </div>
            {ctrl.meta.featuredUrl && (
              <div className="fb-thumb">
                <img src={ctrl.meta.featuredUrl} alt="Featured" />
                <button className="fb-x" onClick={() => ctrl.setFeatured(null)} title="Remove">×</button>
              </div>
            )}
          </div>
        </div>

        <div className="fb-panel-sec">
          <div className="fb-sec-h">Bookmarks</div>

          {/* форма додавання: label + page (optional) */}
          <div className="fb-row fb-row-wrap">
            <input className="fb-inp" placeholder="Label (optional)" id="fb-bmk-label" />
            <input className="fb-inp fb-inp-narrow" placeholder={`Page (optional)`} id="fb-bmk-page" inputMode="numeric" pattern="[0-9]*" />
          </div>

          {/* палітра кольорів + custom + add без кольору */}
          <div className="fb-row fb-colors">
            {brandColors.map((c) => (
              <button
                key={c}
                className="fb-color-swatch"
                title={c}
                style={{ background: c }}
                onClick={() => {
                  const labelEl = document.getElementById("fb-bmk-label") as HTMLInputElement | null;
                  const pageEl = document.getElementById("fb-bmk-page") as HTMLInputElement | null;
                  const pageVal = pageEl?.value?.trim();
                  const pageNum = pageVal ? Number(pageVal) : undefined;
                  ctrl.addBookmark({ page: isFinite(pageNum || NaN) ? pageNum : undefined, label: labelEl?.value, color: c as any });
                  if (labelEl) labelEl.value = "";
                  if (pageEl) pageEl.value = "";
                }}
              />
            ))}
            <input
              type="color"
              className="fb-color-picker"
              title="Custom color"
              onChange={(e) => {
                const custom = e.target.value || null;
                const labelEl = document.getElementById("fb-bmk-label") as HTMLInputElement | null;
                const pageEl = document.getElementById("fb-bmk-page") as HTMLInputElement | null;
                const pageVal = pageEl?.value?.trim();
                const pageNum = pageVal ? Number(pageVal) : undefined;
                ctrl.addBookmark({ page: isFinite(pageNum || NaN) ? pageNum : undefined, label: labelEl?.value, color: custom as any });
                if (labelEl) labelEl.value = "";
                if (pageEl) pageEl.value = "";
                (e.target as HTMLInputElement).value = "#ffffff";
              }}
            />
            <button
              className="lh-iconbtn"
              title="Add without color"
              onClick={() => {
                const labelEl = document.getElementById("fb-bmk-label") as HTMLInputElement | null;
                const pageEl = document.getElementById("fb-bmk-page") as HTMLInputElement | null;
                const pageVal = pageEl?.value?.trim();
                const pageNum = pageVal ? Number(pageVal) : undefined;
                ctrl.addBookmark({ page: isFinite(pageNum || NaN) ? pageNum : undefined, label: labelEl?.value });
                if (labelEl) labelEl.value = "";
                if (pageEl) pageEl.value = "";
              }}
              aria-label="Add bookmark"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* список з редагуванням */}
          <ul className="fb-list">
            {ctrl.bookmarks.map((b) => (
              <li key={b.id} className="fb-item">
                <span className="fb-dot" style={{ background: (b as any).color || "#e7ebdf" }} />
                <input
                  className="fb-inp fb-inp-grow"
                  value={b.label}
                  onChange={(e) => (ctrl as any).updateBookmark?.(b.id, { label: e.target.value })}
                  title="Edit label"
                />
                <input
                  className="fb-inp fb-inp-num"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(b.page)}
                  onChange={(e) => (ctrl as any).updateBookmark?.(b.id, { page: Number(e.target.value || 1) })}
                  title="Edit page"
                />
                <input
                  type="color"
                  className="fb-color-picker mini"
                  value={(b as any).color || "#ffffff"}
                  onChange={(e) => (ctrl as any).updateBookmark?.(b.id, { color: e.target.value as any })}
                  title="Edit color"
                />
                <button className="fb-link" onClick={() => ctrl!.goToBookmark(b.id)} title={`Go to page ${b.page}`}>Go</button>
                <button className="fb-del" onClick={() => ctrl!.removeBookmark(b.id)} title="Remove">✕</button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

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
  const links: Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }> = (bmp?.links as any) ?? [];
  const pageBookmarks = ctrl.bookmarks.filter(b => b.page === pageNum);

  // Сторона для закладки (true = права, false = ліва)
  const isRightPage = pageNum % 2 === 1;

  return (
    <div
      key={i}
      style={{
        width: "100%",
        height: "100%",
        background: "#fff",
        position: "relative"
      }}
      onMouseMove={(e) => ctrl!.handlePageMouseMove(e, pageNum)}
      onMouseLeave={ctrl!.handlePageMouseLeave}
    >
      {/* Закладки поза сторінкою */}
      {pageBookmarks.map((bookmark, idx) => (
  <div
    key={bookmark.id}
    className={`page-bookmark ${isRightPage ? "right" : "left"}`}   // ← ДОДАВ
    style={{
      position: "absolute",
      [isRightPage ? "right" : "left"]: 0,
      // ↓ зсув і масштаб через змінні, щоб hover міг міняти лише scale
      transform: "translateX(var(--bmX)) scale(var(--bmScale, 1))",
      ["--bmX" as any]: isRightPage ? "calc(100% - 2px)" : "calc(-100% + 2px)",
      transformOrigin: isRightPage ? "left center" : "right center",
      top: `${20 + idx * 50}px`,
      width: "80px",
      height: "40px",
      background: bookmark.color || "#f47e20",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: isRightPage ? "flex-start" : "flex-end",
      fontSize: "11px",
      fontWeight: 700,
      borderTopLeftRadius: isRightPage ? 0 : "8px",
      borderBottomLeftRadius: isRightPage ? 0 : "8px",
      borderTopRightRadius: isRightPage ? "8px" : 0,
      borderBottomRightRadius: isRightPage ? "8px" : 0,
      boxShadow: isRightPage ? "-2px 2px 8px rgba(0,0,0,.2)" : "2px 2px 8px rgba(0,0,0,.2)",
      cursor: "pointer",
      zIndex: 200,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      padding: "0 6px",
    }}
    onClick={() => ctrl!.goToBookmark(bookmark.id)}
    title={bookmark.label}
  >
    {bookmark.label}
  </div>
))}


      {/* Сторінка */}
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
              display: "block"
            }}
          />
          {links?.length
            ? links.map((L: typeof links[0], idx: number) =>
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
        <div style={{ textAlign: "center", lineHeight: "350px", color: "#bbb" }}>Рендер сторінки…</div>
      )}
    </div>
  );
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
        html, body {
          margin: 0;
          height: 100%;
          background: #21353a;
          overflow: hidden !important;
        }
        * { box-sizing: border-box; }
        :root { --hdr: 56px; --ftr: 64px; }
        @media (max-width: 680px) {
          :root { --hdr: 56px; --ftr: 72px; }
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

/* Закладка може виходити за межі сторінки FlipBook */
/* щоб елементи могли виходити за межі сторінки */
.page, .page > div, .page .page-content { overflow: visible !important; }
.page .page-content { position: relative; }

.page-bookmark{
  transition:
    transform 0.21s cubic-bezier(.7,0,.2,1),
    width 0.21s cubic-bezier(.7,0,.2,1),
    height 0.21s cubic-bezier(.7,0,.2,1),
    font-size 0.21s cubic-bezier(.7,0,.2,1);
}

/* правий/лівий — різні селектори збережені */
.page-bookmark.right:hover,
.page-bookmark.left:hover{
  --bmScale: 1.07;     /* <- працює поверх inline, бо це змінна */
  width: 88px;
  height: 43px;
  font-size: 1.07em;
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
          transition: transform 500ms cubic-bezier(.7,0,.2,1);
        }
        .book-container.is-cover {
          transform: translateX(-24%);
        }
        @keyframes book-opening {
          0% { transform: translateX(-24%); }
          100% { transform: translateX(0); }
        }
        .pdf-link {
          border: 0;
          background: transparent;
          cursor: pointer;
          display: block;
        }
        .pdf-link:focus-visible {
          outline: 2px dashed rgba(28,121,228,.6);
          outline-offset: 1px;
        }

        /* --- Sticky left panel (overlay) --- */
        .fb-sticky-panel{
          position: fixed; left: 16px; top: calc(var(--hdr) + 16px);
          width: 320px; /* збільшено */
          max-height: calc(100svh - var(--hdr) - 32px);
          overflow: auto; z-index: 999;
          padding: 12px; background:#ffffffef; backdrop-filter: blur(6px);
          border:1px solid #e7ebdf; border-radius:.9rem;
          box-shadow:0 12px 28px rgba(0,0,0,.12); color:#2d3018;
        }
        .fb-panel-sec{ background:#fff; border:1px solid #e7ebdf; border-radius:.8rem; padding:10px 10px 12px; box-shadow:0 4px 12px rgba(0,0,0,.06); }
        .fb-panel-sec + .fb-panel-sec{ margin-top:12px; }
        .fb-sec-h{ font-weight:900; color:#2d3018; margin-bottom:6px; }
        .fb-field{ display:block; margin-bottom:8px; }
        .fb-lab{ font-size:12px; color:#5c6750; margin-bottom:4px; }
        .fb-inp, .fb-txt{ width:100%; border:1px solid #e7ebdf; border-radius:.6rem; padding:.45rem .6rem; color:#2d3018; background:#fff; }
        .fb-inp-narrow{ width:110px; }
        .fb-inp-num{ width:72px; text-align:center; }
        .fb-inp-grow{ flex:1; min-width:0; }
        .fb-row{ display:flex; align-items:center; gap:8px; }
        .fb-row-wrap{ flex-wrap:wrap; }

        .fb-thumb{ position:relative; margin-top:8px; }
        .fb-thumb img{ width:100%; display:block; border-radius:.6rem; border:1px solid #e7ebdf; }
        .fb-thumb .fb-x{ position:absolute; top:4px; right:4px; background:#fff; border:1px solid #e7ebdf; border-radius:.5rem; width:28px; height:28px; line-height:0; }

        .fb-list{ list-style:none; margin:8px 0 0; padding:0; }
        .fb-item{ display:flex; align-items:center; gap:6px; padding:6px 0; border-top:1px dashed #ecefe7; }
        .fb-item:first-child{ border-top:0; }
        .fb-dot{ width:14px; height:14px; border-radius:50%; border:1px solid #d7dccf; flex:0 0 14px; }
        .fb-link{ background:#fff; border:1px solid #e7ebdf; border-radius:.55rem; padding:.35rem .55rem; }
        .fb-del{ background:#fff; border:1px solid #e7ebdf; border-radius:.55rem; width:28px; height:28px; }

        .fb-colors{ align-items:center; gap:8px; flex-wrap:wrap; }
        .fb-color-swatch{ width:24px; height:24px; border-radius:50%; border:1px solid #d7dccf; }
        .fb-color-picker{ width:40px; height:32px; border:1px solid #e7ebdf; border-radius:.55rem; background:#fff; padding:0; }
        .fb-color-picker.mini{ width:32px; height:28px; }

        @media (max-width: 860px){ .fb-sticky-panel{ left:8px; width:min(92vw, 360px); } }
      `}</style>
      <style dangerouslySetInnerHTML={{ __html: ctrl.globalCss }} />
    </div>
  );
}
