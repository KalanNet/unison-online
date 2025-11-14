"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useViewerController } from "../secure/editor/useEditorController";
import EditorHeader from "../secure/editor/EditorHeader";
import ViewerFooter from "../secure/editor/EditorFooter";
import MobileHeader from "./MobileHeader";
import MobilePager from "./MobilePager";

// той самий FlipBook
const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

/* --- тип закладки --- */
type Bookmark = { id: string; page: number; label: string; color?: string | null };

/** Хук для брейкпоінта 980px */
function useIsMobile(bp = 980) {
  const [isMob, setIsMob] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const on = () => setIsMob(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return isMob;
}

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
  // --- Search UI state (for header) ---
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  const initPageRef = React.useRef<number | null>(null);
  const suppressNavRef = React.useRef<boolean>(false);

  // 1) ХУК КОНТРОЛЕРА — БЕЗ try/catch і setState під час рендера
  const ctrl = useViewerController({ file, title });

  // 2) ВИКЛИК ХУКА ДЛЯ МОБІЛЬНОГО — ДО БУДЬ-ЯКИХ РАННІХ return
  const isMobile = useIsMobile(980);

  // --- закладки: відсортовані, глобальний індекс, коефіцієнт перекриття ---
  const bmSorted = React.useMemo(
    () => [...bookmarks].sort((a, b) => a.page - b.page),
    [bookmarks]
  );

  // Глобальний порядковий індекс кожної закладки
  const bmIndex = React.useMemo(
    () => new Map(bmSorted.map((b, i) => [b.id, i])),
    [bmSorted]
  );

  // Коефіцієнт кроку між закладками (1 = повний рознос, 0.5 = ~50% перекриття)
    const bmStep = React.useMemo(() => {
    const total = bmSorted.length;
    if (total <= 1) return 1;

    const bookHeight = Math.round((ctrl.baseSize?.h ?? 0) * (ctrl.fitScale ?? 1));
    if (!bookHeight || !Number.isFinite(bookHeight)) return 1;

    const TAB_LEN = 140;   // відповідає --tabLength
    const TOP = 36;        // відповідає --tabTop
    const BOTTOM = 24;     // невеликий відступ знизу

    // висота, яка лишається на стиснення МІЖ першою і останньою вкладкою
    const usable = bookHeight - TOP - BOTTOM - TAB_LEN;
    if (usable <= 0) return 1;

    const denom = (total - 1) * TAB_LEN; // сумарна висота проміжків
    if (usable >= denom) return 1;       // місця достатньо, вкладки не перекриваються

    const step = usable / denom;         // наскільки стискаємо
    return Math.max(0.25, step);         // можна сховати майже все, але не менше 25%
  }, [bmSorted.length, ctrl.baseSize?.h, ctrl.fitScale]);

    const jumpToPdfPage = React.useCallback(
    (page1: number) => {
      if (!ctrl) return;

      // page1 — 1-based (як у PDF), а FlipBook працює з 0-based
      const target = Math.max(0, (page1 || 1) - 1);

      if (ctrl.currentIndex === target) return;

      // спочатку оновлюємо state контролера
      ctrl.setCurrentIndex(target);

      // у наступний кадр даємо команду самому FlipBook
      setTimeout(() => {
        const api = (ctrl.bookRef.current as any)?.pageFlip?.();
        if (api?.turnToPage) {
          api.turnToPage(target);
        } else if (typeof (ctrl as any).goToPage === "function") {
          (ctrl as any).goToPage(target);
        } else if (api?.flip) {
          api.flip(target);
        }
      }, 0);
    },
    [ctrl]
  );


  // 3) Зафіксувати стартову сторінку (один раз)
  if (ctrl && initPageRef.current === null) {
    initPageRef.current = ctrl.currentIndex; // зафіксувати стартову сторінку лише раз
  }

  // === AUTO-SEARCH (debounced, only on q/file change) ===
  const lastSigRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!ctrl) return;
    const qTrim = q.trim();
    const sig = `${file}::${qTrim}`;
    if (lastSigRef.current === sig) return;
    lastSigRef.current = sig;

    const t = setTimeout(() => {
      ctrl.runSearch(qTrim);
    }, 250);

    return () => clearTimeout(t);
  }, [q, file, !!ctrl]);
  // === /AUTO-SEARCH ===

  // ---- РАННІ ВАЛІДАЦІЇ ----
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
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>
          Файл не знайдено або неправильний формат!
        </h2>
        <div style={{ color: "#aaa", marginTop: 12, fontSize: 16 }}>
          Передай коректний PDF через публічне посилання.
        </div>
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
        <h2 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}>Loading…</h2>
      </div>
    );
  }

  // --- МОБІЛЬНИЙ РЕНДЕР на ≤980px ---
  if (isMobile) {
    // Адаптер: примусово даємо мобільні версії переходів БЕЗ FlipBook
    // локальні хелпери підвантаження сторінок (щоб не було TS-помилок)
    const ensureRendered = (idx: number) => {
      // якщо ваш контролер має власний метод — викличеться він;
      // інакше пробуємо типові варіанти (1-based API)
      try {
        (ctrl as any).ensureRendered?.(idx);
      } catch {}
      try {
        (ctrl as any).renderPage?.(idx + 1);
      } catch {}
      try {
        (ctrl as any).renderThumb?.(idx + 1);
      } catch {}
    };

    const warmPagesAround = (idx: number) => {
      [idx - 1, idx + 1].forEach((i) => {
        if (i >= 0 && i < ctrl.totalPages) ensureRendered(i);
      });
    };

    const mCtrl = {
      ...ctrl,
      goToPage: (idx: number) => {
        const safe = Math.max(0, Math.min(idx, ctrl.totalPages - 1));
        ctrl.setCurrentIndex(safe);
        ensureRendered(safe);
        warmPagesAround(safe);
      },
      goNext: () => {
        if (!ctrl.canNext) return;
        const next = ctrl.currentIndex + 1;
        ctrl.setCurrentIndex(next);
        ensureRendered(next);
        warmPagesAround(next);
      },
      goPrev: () => {
        if (!ctrl.canPrev) return;
        const prev = ctrl.currentIndex - 1;
        ctrl.setCurrentIndex(prev);
        ensureRendered(prev);
        warmPagesAround(prev);
      },
      submitJump: () => {
        const n = parseInt(String(ctrl.pageJump), 10);
        if (!Number.isFinite(n)) return;
        const target = Math.max(1, Math.min(n, ctrl.totalPages)) - 1; // 0-based
        const safe = Math.max(0, Math.min(target, ctrl.totalPages - 1));
        ctrl.setCurrentIndex(safe);
        ensureRendered(safe);
        warmPagesAround(safe);
      },
    };

    return (
      <div className="viewer-root" style={{ background: "#21353a" }}>
        <MobileHeader
          title={ctrl.title}
          file={file}
          searchQuery={q}
          setSearchQuery={setQ}
          runSearch={(qq: string) => setQ(qq)} // тригерить авто-пошук через useEffect
          searching={ctrl.searching}
          hits={ctrl.hits}
          onGoto={(p: number) => mCtrl.goToPage(p - 1)} // p з хедера 1-based
          onShare={ctrl.handleShare}
          splashActive={false}
        />

        <MobilePager
          ctrl={mCtrl as any}
          file={file}
          title={ctrl.title}
          searchQuery={q}
          setSearchQuery={setQ}
          runSearch={(qq: string) => setQ(qq)}
          searching={ctrl.searching}
          hits={ctrl.hits}
          onGoto={(p: number) => mCtrl.goToPage(p - 1)}
          onShare={ctrl.handleShare}
        />

        {/* тільки для мобільного режиму — блокуємо прокрутку всього документу */}
        <style jsx global>{`
          html,
          body {
            height: 100svh;
            overflow: hidden;
          }
          .viewer-root {
            min-height: 100svh;
          }
        `}</style>
      </div>
    );
  }

  // прапорці для обкладинок (десктоп)
  const isFrontCover = ctrl.currentIndex === 0;
  const isBackCover = ctrl.currentIndex === ctrl.totalPages - 1;

  // --- ДЕСКТОП (FlipBook) ---
  return (
    <div className="viewer-root">
      <EditorHeader
        title={ctrl.title}
        onSearch={(term) => setQ(term)} // лише оновлюємо стан; пошук зробить useEffect
        isSearching={(ctrl as any).searching ?? false}
        file={file}
        isFs={ctrl.isFs}
        toggleFullscreen={ctrl.toggleFullscreen}
        handleShare={ctrl.handleShare}
        onPublish={() => {}} // прибито на публічній сторінці
        // --- нове: керування полем пошуку ---
        searchOpen={searchOpen}
        onSearchToggle={setSearchOpen}
        searchQuery={q}
        onSearchChange={(v) => {
          setQ(v);
        }}
      />

      <section ref={ctrl.stageRef} className="viewer-stage">
        {/* резервуємо місце і пробрасываем --bm-step у CSS */}
        <div
          className="stage-rail"
          style={{ "--bm-step": bmStep } as React.CSSProperties}
        >
          <div
            className={`book-container${isFrontCover ? " is-cover" : ""}${
              isBackCover ? " is-backcover" : ""
            }${ctrl.single ? " single" : ""}`}
            style={{
              transition: `transform ${isBackCover ? 1000 : 500}ms ease-in-out`,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: ctrl.single
                ? Math.round(ctrl.baseSize.w * ctrl.fitScale)
                : Math.round(ctrl.baseSize.w * ctrl.fitScale * 2),
              height: Math.round(ctrl.baseSize.h * ctrl.fitScale),
              maxWidth: "100%",
              maxHeight: "100%",
              position: "relative",
            }}
          >
            <FlipBook
              ref={ctrl.bookRef}
              width={ctrl.baseSize.w}
              height={ctrl.baseSize.h}
              size="stretch"
              usePortrait={ctrl.single}
              showCover={true}
              flippingTime={900}
              maxShadowOpacity={0.2}
              drawShadow
              mobileScrollSupport
              disableFlipByClick
              showHint={false}
              useMouseEvents={false}
              clickEventForward
              startPage={(initPageRef.current ?? 0) as number}
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
                const links: Array<{
                  x: number;
                  y: number;
                  w: number;
                  h: number;
                  href?: string;
                  dest?: any;
                }> = (bmp?.links as any) ?? [];

                return (
                  <div
                    key={i}
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

                        {/* === HIGHLIGHTS LAYER === */}
                        <div className="hl-layer" aria-hidden>
                          {(((ctrl as any).pageHighlights?.get?.(pageNum)) ?? []).map(
                            (r: any, j: number) => {
                              const isActive =
                                typeof r.hitIndex === "number" &&
                                r.hitIndex === (ctrl as any).activeHit;
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
                            }
                          )}
                        </div>
                        {/* === /HIGHLIGHTS LAYER === */}
                        {/* === BOOKMARK TABS (ONLY for current spread pages) === */}
                        {bmSorted
                          .filter((b) => b.page === pageNum)
                          .map((bm) => {
                            const i = bmIndex.get(bm.id) ?? 0;

                            const curr = ctrl.currentIndex + 1; // 1-based
                            const leftNow = ctrl.single
                              ? curr
                              : curr % 2 === 0
                              ? curr
                              : curr - 1;
                            const rightNow = Math.min(
                              leftNow + 1,
                              ctrl.totalPages
                            );

                            const isCurrentLeft = pageNum === leftNow;
                            const isCurrentRight = pageNum === rightNow;

                            // з якого боку сторінки має стирчати закладка
                            const sideIsLeft = ctrl.single
                              ? bm.page < curr
                              : bm.page <= leftNow;

                            // показуємо кнопку лише на зовнішній стороні аркуша
                            const shouldAttach =
                              (isCurrentLeft && sideIsLeft) ||
                              (isCurrentRight && !sideIsLeft);

                            if (!shouldAttach) return null;

                            const style: React.CSSProperties = {
                              position: "absolute",
                              zIndex: 90,
                              top: `calc(var(--tabTop,36px) + ${i} * var(--tabLength,140px) * var(--bm-step,1))`,
                              width: "var(--tabThickness,36px)",
                              height: "var(--tabLength,140px)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 600, // тонший шрифт
                              lineHeight: 1,
                              border: "1px solid rgba(0,0,0,.18)",
                              boxShadow: "0 2px 6px rgba(0,0,0,.12)",
                              opacity: 0.98,
                              pointerEvents: "auto",
                              background: bm.color || "#f47e20",
                              ...(isCurrentLeft
                                ? {
                                    left: 0,
                                    transformOrigin: "left center",
                                    transform:
                                      "translateZ(0.01px) translateX(var(--tabInset,-35px))",
                                    borderRadius: "10px 0 0 10px",
                                  }
                                : {
                                    right: 0,
                                    transformOrigin: "right center",
                                    transform:
                                      "translateZ(0.01px) translateX(calc(-1 * var(--tabInset,-35px)))",
                                    borderRadius: "0 10px 10px 0",
                                  }),
                            };

                            return (
                              <button
                                key={bm.id}
                                className={`bm-tab ${
                                  sideIsLeft ? "left" : "right"
                                } active`}
                                title={`${bm.label} (p.${bm.page})`}
                                style={style}
                                onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  jumpToPdfPage(bm.page ?? 1);
}}

                              >
                                <span className="bm-tab__label">
                                  {bm.label}
                                </span>
                              </button>
                            );
                          })}
                        {/* === /BOOKMARK TABS === */}


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
                                  onClick={() =>
                                    L.dest ? (ctrl as any).goToDest?.(L.dest) : null
                                  }
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
                      <div
                        style={{
                          textAlign: "center",
                          lineHeight: "350px",
                          color: "#bbb",
                        }}
                      >
                        Page Loading…
                      </div>
                    )}
                  </div>
                );
              })}
            </FlipBook>

                       {/* === ALWAYS-VISIBLE RAILS === */}
            {bmSorted.length > 0 && (
              <div className="bm-rails" aria-hidden={false}>
                {/* ліва рейка: усі сторінки ДО поточної лівої */}
                <div className="bm-rail left">
                  {(() => {
                    const curr = ctrl.currentIndex + 1;
                    const leftNow = ctrl.single
                      ? curr
                      : curr % 2 === 0
                      ? curr
                      : curr - 1;

                    return bmSorted
                      .filter((bm) => bm.page < leftNow)
                      .map((bm) => {
                        const pos = bmIndex.get(bm.id) ?? 0;

                        return (
                          <button
                            key={bm.id}
                            className="bm-tab left"
                            title={`${bm.label} (p.${bm.page})`}
                            onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  jumpToPdfPage(bm.page ?? 1);
}}

                            style={
  {
    "--bm-i": String(pos),
    background: bm.color || "#f47e20",
    zIndex: bmSorted.length - pos,     // перша завжди поверх
  } as React.CSSProperties
}
>
                            <span className="bm-tab__label">{bm.label}</span>
                          </button>
                        );
                      });
                  })()}
                </div>

                {/* права рейка: усі сторінки ПІСЛЯ поточної правої */}
                <div className="bm-rail right">
                  {(() => {
                    const curr = ctrl.currentIndex + 1;
                    const leftNow = ctrl.single
                      ? curr
                      : curr % 2 === 0
                      ? curr
                      : curr - 1;
                    const rightNow = Math.min(
                      leftNow + 1,
                      ctrl.totalPages
                    );

                    return bmSorted
                      .filter((bm) => bm.page > rightNow)
                      .map((bm) => {
                        const pos = bmIndex.get(bm.id) ?? 0;

                        return (
                          <button
                            key={bm.id}
                            className="bm-tab right"
                            title={`${bm.label} (p.${bm.page})`}
                            onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  jumpToPdfPage(bm.page ?? 1);
}}

                            style={
  {
    "--bm-i": String(pos),
    background: bm.color || "#f47e20",
    zIndex: bmSorted.length - pos,
  } as React.CSSProperties
}
>

                            <span className="bm-tab__label">{bm.label}</span>
                          </button>
                        );
                      });
                  })()}
                </div>
              </div>
            )}
            {/* === /ALWAYS-VISIBLE RAILS === */}

            {/* Кутові хендли для гортання */}
            <div className="flip-handles" aria-hidden>
              {/* Ліві кути — попередня сторінка */}
              <button
                className="fh tl"
                onMouseDown={(e) => {
                  e.preventDefault();
                  (ctrl.bookRef.current as any)?.pageFlip?.().flipPrev();
                }}
              />
              <button
                className="fh bl"
                onMouseDown={(e) => {
                  e.preventDefault();
                  (ctrl.bookRef.current as any)?.pageFlip?.().flipPrev();
                }}
              />
              {/* Праві кути — наступна сторінка */}
              <button
                className="fh tr"
                onMouseDown={(e) => {
                  e.preventDefault();
                  (ctrl.bookRef.current as any)?.pageFlip?.().flipNext();
                }}
              />
              <button
                className="fh br"
                onMouseDown={(e) => {
                  e.preventDefault();
                  (ctrl.bookRef.current as any)?.pageFlip?.().flipNext();
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* === RIGHT SEARCH FLYOUT === */}
      {q.trim().length > 0 && (
        <aside className="search-flyout" role="region" aria-label="Search results">
          <div className="sf-hd">
            <strong>Search</strong>
            <span className="sf-meta">
              {ctrl.searching ? "Searching…" : `${ctrl.hits.length} results`}
            </span>
            <button
              className="sf-close"
              type="button"
              onClick={() => {
                setQ("");
                setSearchOpen(false);
              }}
              aria-label="Close search"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="sf-list">
            {ctrl.hits.length === 0 && !ctrl.searching && (
              <div className="sf-empty">No matches.</div>
            )}

            {ctrl.hits.map((h, i) => (
              <button
                key={h.id}
                type="button"
                className={`sf-item${i === ctrl.activeHit ? " is-active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const target = Math.max(0, (h.page ?? 1) - 1); // 0-based
                  if (ctrl.currentIndex === target) {
                    ctrl.setActiveHit(i);
                    return;
                  }

                  // 1) спочатку синхронізуємо наш state
                  ctrl.setActiveHit(i);
                  ctrl.setCurrentIndex(target);

                  // 2) у наступний кадр — командуємо FlipBook
                  setTimeout(() => {
                    const api = (ctrl.bookRef.current as any)?.pageFlip?.();
                    if (api?.turnToPage) {
                      api.turnToPage(target); // абсолютний перехід
                    } else if (typeof ctrl.goToPage === "function") {
                      ctrl.goToPage(target);
                    } else if (api?.flip) {
                      api.flip(target);
                    }
                  }, 0);
                }}
                title={`Go to page ${h.page}`}
              >
                <div className="sf-snippet">{h.snippet}</div>
                <div className="sf-meta">Page {h.page}</div>
              </button>
            ))}
          </div>
        </aside>
      )}
      {/* === /RIGHT SEARCH FLYOUT === */}

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
        /* =========================================
         * 1) BASE & CSS VARIABLES
         * =======================================*/
        html,
        body {
          margin: 0;
          height: 100%;
          background: #21353a;
        }
        * {
          box-sizing: border-box;
        }

        :root {
          /* Header/Footer */
          --hdr: 56px;
          --ftr: 64px;

          /* Bookmark tabs */
          --tabThickness: 36px;  /* ширина вкладки */
          --tabLength: 140px;    /* висота вкладки */
          --tabGap: 0px;         /* НУЛЬОВИЙ проміжок, йдуть «встик» */
          --tabTop: 36px;
          --tabInset: -35px;
          --bm-step: 1;          /* множник кроку між вкладками, JS може змінити */

          /* Сервісні */
          --rail: calc(var(--tabThickness) + 12px);
          --corner-size: 70px;
        }

        @media (max-width: 680px) {
          :root {
            --hdr: 56px;
            --ftr: 72px;
            --rail: calc(var(--tabThickness) + 10px);
          }
        }

        /* =========================================
         * 2) APP LAYOUT
         * =======================================*/
        .viewer-root {
          min-height: 100dvh;
          width: 100%;
          display: flex;
          flex-direction: column;
          color: #fff;
          background: #21353a;
          overflow: hidden;
        }
        .local-header {
          height: var(--hdr);
          min-height: var(--hdr);
          z-index: 120;
        }
        .local-footer {
          height: var(--ftr);
          min-height: var(--ftr);
          z-index: 101;
        }
        button[aria-label='Publish'] {
          display: none !important;
        }

        .viewer-stage {
          flex: 1 1 auto;
          width: 100%;
          min-height: 0;
          min-width: 0;
          height: calc(100dvh - var(--hdr) - var(--ftr));
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        /* Контейнер сцени з боковими полями під рейки */
        .stage-rail {
          position: relative;
          width: 100%;
          height: 100%;
          padding-inline: var(--rail);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          max-width: 100%;
        }

        /* =========================================
         * 3) FLIPBOOK CONTAINER
         * =======================================*/
        .book-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          min-width: 0;
          min-height: 0;
          transition: transform 500ms cubic-bezier(0.7, 0, 0.2, 1);
          position: relative;
        }
        .book-container.is-cover {
          transform: translateX(-24%);
        }
        .book-container.is-backcover {
          transform: translateX(24%);
        }

        /* =========================================
         * 4) PAGE PLANE & OVERLAYS
         * =======================================*/
        .page,
        .page > div,
        .page .page-content {
          overflow: visible !important;
        }
        .page .page-content {
          position: relative;
          transform-style: preserve-3d;
        }

        /* Клікабельні PDF-зони */
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

        /* =========================================
         * 5) SEARCH FLYOUT
         * =======================================*/
        .search-flyout {
          position: fixed;
          top: var(--hdr);
          right: 12px;
          bottom: var(--ftr);
          width: min(360px, 92vw);
          background: #fff;
          color: #1b2430;
          border: 1px solid #e7ebdf;
          border-radius: 14px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
          z-index: 320;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sf-hd {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #fafbf8;
          border-bottom: 1px solid #eef2e6;
          font-weight: 800;
        }
        .sf-hd .sf-meta {
          margin-left: auto;
          color: #5b6a50;
          font-weight: 600;
        }
        .sf-close {
          background: #fff;
          border: 1px solid #e7ebdf;
          border-radius: 0.6rem;
          padding: 0.2rem 0.55rem;
          line-height: 1;
          font-weight: 900;
          color: #2d3018;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }
        .sf-list {
          overflow: auto;
          padding: 6px 0;
          flex: 1 1 auto;
          background: #fff;
        }
        .sf-empty {
          padding: 16px 14px;
          color: #6b7280;
          font-style: italic;
        }
        .sf-item {
          width: 100%;
          text-align: left;
          background: #fff;
          border: 0;
          border-bottom: 1px solid #f1f4ec;
          padding: 10px 12px;
          cursor: pointer;
        }
        .sf-item:hover {
          background: #f8faf5;
        }
        .sf-item.is-active {
          outline: 2px solid #8ea05a33;
          background: #f6f9f1;
        }
        .sf-snippet {
          font-size: 14px;
          color: #111827;
          line-height: 1.35;
        }
        .sf-meta {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        /* =========================================
         * 6) TEXT HIGHLIGHTS
         * =======================================*/
        .hl-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
        }
        .hl {
          position: absolute;
          background: rgba(255, 226, 61, 0.28);
          outline: 2px solid rgba(255, 200, 0, 0.9);
          border-radius: 2px;
          mix-blend-mode: multiply;
        }
        .hl.is-active {
          background: rgba(56, 189, 248, 0.25);
          outline-color: rgba(56, 189, 248, 0.95);
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25) inset;
        }

        /* =========================================
         * 7) PAGE-CORNER FLIP HANDLES
         * =======================================*/
        .flip-handles {
          position: absolute;
          inset: 0;
          z-index: 210;
          pointer-events: none;
        }
        .flip-handles .fh {
          position: absolute;
          width: var(--corner-size);
          height: var(--corner-size);
          border: 0;
          background: transparent;
          pointer-events: auto;
          cursor: grab;
        }
        .flip-handles .tl {
          left: 0;
          top: 0;
          clip-path: polygon(0 0, 100% 0, 0 100%);
        }
        .flip-handles .bl {
          left: 0;
          bottom: 0;
          clip-path: polygon(0 100%, 0 0, 100% 100%);
        }
        .flip-handles .tr {
          right: 0;
          top: 0;
          clip-path: polygon(100% 0, 0 0, 100% 100%);
        }
        .flip-handles .br {
          right: 0;
          bottom: 0;
          clip-path: polygon(100% 100%, 0 100%, 100% 0);
        }

        /* =========================================
         * 8) BOOKMARK TABS — COMMON LOOK
         * =======================================*/
        .bm-tab {
          border: 0;
          cursor: pointer;
          --bmScale: 1;
          will-change: transform;
          color: #fff;
          font-weight: 500; /* тонкий шрифт */
          font-size: 15px;
          line-height: 1;
          border: 1px solid rgba(0, 0, 0, 0.18);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
          transition: transform 0.18s ease, filter 0.18s ease;
        }
        .bm-tab:hover {
          transform: scale(1.06);
          filter: brightness(1.03);
        }
        .bm-tab:active {
          transform: scale(1.03);
        }
        .bm-tab__label {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          max-height: calc(var(--tabLength) - 10px);
          padding: 4px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.08em; /* трохи більший крок між літерами */
        }

        /* =========================================
         * 9) BOOKMARK RAILS (ALWAYS VISIBLE)
         * =======================================*/
        .bm-rails {
          position: absolute;
          inset: 0;
          z-index: 200;
          pointer-events: none;
        }

        .bm-rail {
          position: absolute;
          top: 0;
          bottom: 0;
          width: var(--tabThickness);
          pointer-events: none;
        }
        .bm-rail.left {
          left: 0;
          transform: translateX(var(--tabInset));
        }
        .bm-rail.right {
          right: 0;
          transform: translateX(calc(-1 * var(--tabInset)));
        }

        .bm-rail .bm-tab {
          position: absolute;
          pointer-events: auto;
          top: calc(
            var(--tabTop) +
              var(--bm-i) * var(--tabLength) * var(--bm-step, 1)
          );
          width: var(--tabThickness);
          height: var(--tabLength);
          background: #f47e20; /* колір може бути перезаписаний інлайном */
        }
        .bm-rail .bm-tab.left {
          left: 0;
          border-radius: 10px 0 0 10px;
        }
        .bm-rail .bm-tab.right {
          right: 0;
          border-radius: 0 10px 10px 0;
        }

        /* =========================================
         * 10) LARGE THIN PAGE ARROWS НА КРАЯХ
         * =======================================*/
        .page-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 230;
          width: 72px;
          height: 120px;
          border: none;
          background: transparent;
          padding: 0;
          cursor: pointer;
          opacity: 0.55;
          transition: opacity 0.2s ease, transform 0.2s ease,
            background-color 0.2s ease;
          user-select: none;
          font-size: 0; /* ховаємо текстовий символ, працюємо псевдоелементом */
          color: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
        }
        .page-arrow.left {
          left: 16px;
        }
        .page-arrow.right {
          right: 16px;
        }
        .page-arrow::before {
          content: '';
          display: block;
          width: 22px;
          height: 22px;
          border-top: 2px solid rgba(255, 255, 255, 0.95);
          border-left: 2px solid rgba(255, 255, 255, 0.95);
          transform: rotate(-45deg);
        }
        .page-arrow.right::before {
          transform: rotate(135deg);
        }
        .page-arrow:hover {
          opacity: 1;
          transform: translateY(-50%) scale(1.06);
        }
        .page-arrow:active {
          transform: translateY(-50%) scale(1.02);
        }
        .page-arrow.disabled {
          opacity: 0.18;
          cursor: not-allowed;
          pointer-events: none;
        }
        @media (max-width: 980px) {
          .page-arrow {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
