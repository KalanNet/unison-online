"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useViewerController } from "../secure/editor/useEditorController";
import EditorHeader from "../secure/editor/EditorHeader";
import ViewerFooter from "../secure/editor/EditorFooter";
import MobileHeader from "./MobileHeader";
import MobilePager from "./MobilePager";
import LeftAdsPanel from "../secure/editor/LeftAdsPanel";
import RightContentPanel, { type TocItem } from "../secure/editor/RightContentPanel";


// той самий FlipBook
const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

/* --- тип закладки --- */
type Bookmark = { id: string; page: number; label: string; color?: string | null };

type AdSlot = { id: string; imageUrl: string; href?: string | null; label?: string | null };

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
  ads = [],
  content = [],              // ← НОВЕ
}: {
  file: string;
  title?: string;
  bookmarks?: Bookmark[];
  ads?: AdSlot[];
  content?: TocItem[];       // ← НОВЕ
}) {
  // --- Search UI state (for header) ---
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  const initPageRef = React.useRef<number | null>(null);
  const suppressNavRef = React.useRef<boolean>(false);

   // 2) ВИКЛИК ХУКА ДЛЯ МОБІЛЬНОГО — ДО БУДЬ-ЯКИХ РАННІХ return
  const isMobile = useIsMobile(980);

  // 🔇 локальний мут
  const [soundMuted, setSoundMuted] = React.useState(false);
  const toggleSound = React.useCallback(() => setSoundMuted((v) => !v), []);

  // 🔊 один-єдиний audio-об’єкт
  const flipAudioRef = React.useRef<HTMLAudioElement | null>(null);
  // 2. 👇 ДОДАЄМО ПЕРЕВІРКУ В playFlip
  const playFlip = React.useCallback(() => {
    if (isMobile) return; // <--- 🔕 Блокуємо звук на мобайлі
    if (soundMuted) return;
    
    const a = flipAudioRef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      void a.play();
    } catch {}
  }, [soundMuted, isMobile]); // <--- додаємо isMobile в залежності

  // 1) ХУК КОНТРОЛЕРА
  const ctrl = useViewerController({ file, title });

 

  // --- FOOTER API WRAPPER: звук ДО переходу ---
  const footerApi = React.useMemo(() => {
    if (!ctrl) {
      return {
        goFirst: () => {},
        goPrev: () => {},
        goNext: () => {},
        goLast: () => {},
        submitJump: () => {},
      };
    }
    return {
      goFirst: () => {
        if (!ctrl.totalPages || ctrl.currentIndex === 0) return;
        playFlip();
        ctrl.goFirst();
      },
      goPrev: () => {
        if (!ctrl.canPrev) return;
        playFlip();
        ctrl.goPrev();
      },
      goNext: () => {
        if (!ctrl.canNext) return;
        playFlip();
        ctrl.goNext();
      },
      goLast: () => {
        if (!ctrl.totalPages || ctrl.currentIndex === ctrl.totalPages - 1) return;
        playFlip();
        ctrl.goLast();
      },
      submitJump: () => {
        const before = ctrl.currentIndex;
        ctrl.submitJump();
        setTimeout(() => {
          if (ctrl.currentIndex !== before) playFlip();
        }, 0);
      },
    };
  }, [ctrl, playFlip]);
  // --- /FOOTER API WRAPPER ---

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

  // Коефіцієнт кроку між закладками
  const bmStep = React.useMemo(() => {
    const total = bmSorted.length;
    if (total <= 1) return 1;

    const bookHeight = Math.round((ctrl?.baseSize?.h ?? 0) * (ctrl?.fitScale ?? 1));
    if (!bookHeight || !Number.isFinite(bookHeight)) return 1;

    const TAB_LEN = 140; // відповідає --tabLength
    const TOP = 36; // --tabTop
    const BOTTOM = 36;

    const usable = bookHeight - TOP - BOTTOM - TAB_LEN;
    if (usable <= 0) return 1;

    const denom = (total - 1) * TAB_LEN;
    if (usable >= denom) return 1;

    const step = usable / denom;
    return Math.max(0.25, step);
  }, [bmSorted.length, ctrl?.baseSize?.h, ctrl?.fitScale]);

  /* ---------- ВИПРАВЛЕНИЙ jumpToPdfPage ---------- */
  const jumpToPdfPage = React.useCallback(
    (page1: number) => {
      if (!ctrl) return;

      // 🔊 звук на старті стрибка
      playFlip();

      const total = ctrl.totalPages || 0;
      const safePage =
        total > 0
          ? Math.max(1, Math.min(total, page1 || 1))
          : Math.max(1, page1 || 1);

      const curr = ctrl.currentIndex + 1;
      const leftNow = ctrl.single ? curr : curr % 2 === 0 ? curr : curr - 1;
      const rightNow = Math.min(leftNow + 1, total || leftNow);

      if (safePage === leftNow || safePage === rightNow) {
        return;
      }

      const target = Math.max(0, safePage - 1);

      if (ctrl.currentIndex === target) return;

      ctrl.setCurrentIndex(target);

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
    [ctrl, playFlip]
  );
  /* ---------- /jumpToPdfPage ---------- */

  // 3) Зафіксувати стартову сторінку (один раз)
  if (ctrl && initPageRef.current === null) {
    initPageRef.current = ctrl.currentIndex;
  }

  // === AUTO-SEARCH (1: запуск пошуку) ===
  const lastSearchSigRef = React.useRef<string>("");
  const lastJumpSigRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!ctrl) return;
    const qTrim = q.trim();
    const sig = `${file}::${qTrim}`;

    if (lastSearchSigRef.current === sig) return;
    lastSearchSigRef.current = sig;

    const t = setTimeout(() => {
      ctrl.runSearch(qTrim);
      lastJumpSigRef.current = "";
    }, 400);

    return () => clearTimeout(t);
  }, [q, file, ctrl]);

  // === AUTO-JUMP (2: автоперехід до першого результату через 1.2 c) ===
  React.useEffect(() => {
    if (!ctrl) return;

    const qTrim = q.trim();
    if (!qTrim) return;
    if (!ctrl.hits || ctrl.hits.length === 0) return;

    const sig = `${file}::${qTrim}`;
    if (lastJumpSigRef.current === sig) return;

    const t = setTimeout(() => {
      const nowSig = `${file}::${q.trim()}`;
      if (nowSig !== sig) return;

      lastJumpSigRef.current = sig;

      const first = ctrl.hits[0];
      if (!first?.page) return;

      const target = Math.max(0, first.page - 1);

      if (ctrl.currentIndex === target) return;

      (ctrl as any).setActiveHit?.(0);
      ctrl.setCurrentIndex(target);

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
    }, 1200);

    return () => clearTimeout(t);
  }, [q, file, ctrl, ctrl?.hits]);
  // === /AUTO-SEARCH ===

  // ---- РАННІ ВАЛІДАЦІЇ ----
  if (
    !file ||
    typeof file !== "string" ||
    !/^https?:\/\/.+\.pdf(\?.*)?$/i.test(file)
  ) {
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
        <h2
          style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}
        >
          Loading…
        </h2>
      </div>
    );
  }

  // --- МОБІЛЬНИЙ РЕНДЕР на ≤980px ---
  if (isMobile) {
    const ensureRendered = (idx: number) => {
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
        if (safe === ctrl.currentIndex) return;
        playFlip();
        ctrl.setCurrentIndex(safe);
        ensureRendered(safe);
        warmPagesAround(safe);
      },
      goNext: () => {
        if (!ctrl.canNext) return;
        const next = ctrl.currentIndex + 1;
        const safe = Math.min(next, ctrl.totalPages - 1);
        if (safe === ctrl.currentIndex) return;
        playFlip();
        ctrl.setCurrentIndex(safe);
        ensureRendered(safe);
        warmPagesAround(safe);
      },
      goPrev: () => {
        if (!ctrl.canPrev) return;
        const prev = ctrl.currentIndex - 1;
        const safe = Math.max(prev, 0);
        if (safe === ctrl.currentIndex) return;
        playFlip();
        ctrl.setCurrentIndex(safe);
        ensureRendered(safe);
        warmPagesAround(safe);
      },
      goFirst: () => {
        if (!ctrl.totalPages) return;
        const idx = 0;
        if (idx === ctrl.currentIndex) return;
        playFlip();
        ctrl.setCurrentIndex(idx);
        ensureRendered(idx);
        warmPagesAround(idx);
      },
      goLast: () => {
        if (!ctrl.totalPages) return;
        const idx = ctrl.totalPages - 1;
        if (idx === ctrl.currentIndex) return;
        playFlip();
        ctrl.setCurrentIndex(idx);
        ensureRendered(idx);
        warmPagesAround(idx);
      },
      submitJump: () => {
        const n = parseInt(String(ctrl.pageJump), 10);
        if (!Number.isFinite(n)) return;
        const target = Math.max(1, Math.min(n, ctrl.totalPages)) - 1;
        const safe = Math.max(0, Math.min(target, ctrl.totalPages - 1));
        if (safe === ctrl.currentIndex) return;
        playFlip();
        ctrl.setCurrentIndex(safe);
        ensureRendered(safe);
        warmPagesAround(safe);
      },
    };

    return (
      <div className="viewer-root" style={{ background: "#21353a" }}>
        {/* 🔊 звук перегортання сторінок */}
        <audio ref={flipAudioRef} src="/flipsound.ogg" preload="auto" />

        <MobileHeader
          title={ctrl.title}
          file={file}
          searchQuery={q}
          setSearchQuery={setQ}
          runSearch={(qq: string) => setQ(qq)}
          searching={ctrl.searching}
          hits={ctrl.hits}
          onGoto={(p: number) => mCtrl.goToPage(p - 1)}
          onShare={ctrl.handleShare}
          bookmarks={bookmarks}
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
      {/* 🔊 звук перегортання сторінок */}
      <audio ref={flipAudioRef} src="/flipsound.ogg" preload="auto" />

      {/* Панель: видима на титулці, ховається на інших сторінках */}
      <LeftAdsPanel autoCollapsed={!isFrontCover} items={ads} />

      {/* НОВА ПРАВА ПАНЕЛЬ ЗМІСТУ */}
<RightContentPanel
  autoCollapsed={!isFrontCover}
  items={content}
  onGotoPage={jumpToPdfPage}
/>

      <EditorHeader
        title={ctrl.title}
        onSearch={(term) => setQ(term)}
        isSearching={(ctrl as any).searching ?? false}
        file={file}
        isFs={ctrl.isFs}
        toggleFullscreen={ctrl.toggleFullscreen}
        handleShare={ctrl.handleShare}
        onPublish={() => {}}
        searchOpen={searchOpen}
        onSearchToggle={setSearchOpen}
        searchQuery={q}
        onSearchChange={(v) => setQ(v)}
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
            onFlip={(e: { data: number }) =>
              ctrl!.setCurrentIndex(e.data)
            }
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
              const links:
                | Array<{
                    x: number;
                    y: number;
                    w: number;
                    h: number;
                    href?: string;
                    dest?: any;
                  }>
                | [] = (bmp?.links as any) ?? [];

              // --- SHADOW LOGIC ---
              // Непарні (1, 3...) - це ЛІВІ сторінки. Парні (2, 4...) - ПРАВІ.
              const isLeftPage = i % 2 !== 0;
              
              // Показуємо тінь тільки якщо:
              // 1. Не режим однієї сторінки (!single)
              // 2. Це не передня обкладинка (i !== 0)
              // 3. Це не задня обкладинка (i !== last)
              const showShadow = !ctrl.single && i !== 0 && i !== ctrl.totalPages - 1;

              return (
                <div
                  key={i}
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "#fff",
                    position: "relative",
                  }}
                  onMouseMove={(e) =>
                    ctrl!.handlePageMouseMove(e, pageNum)
                  }
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

                      {/* === SPINE SHADOW (ТІНЬ КОРІНЦЯ) === */}
                      {showShadow && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            width: "35px", // Ширина градієнта тіні
                            zIndex: 4,     // Поверх картинки, але під хайлайтами/лінками
                            pointerEvents: "none",
                            // Якщо сторінка зліва -> корінець справа (right: 0)
                            // Якщо сторінка справа -> корінець зліва (left: 0)
                            [isLeftPage ? "right" : "left"]: 0,
                            background: isLeftPage
                              ? "linear-gradient(to left, rgba(0,0,0,0.15) 0%, transparent 100%)"
                              : "linear-gradient(to right, rgba(0,0,0,0.15) 0%, transparent 100%)",
                          }}
                        />
                      )}

                      {/* === HIGHLIGHTS LAYER === */}
                      <div className="hl-layer" aria-hidden>
                        {(((ctrl as any).pageHighlights?.get?.(
                          pageNum
                        )) ?? []
                        ).map((r: any, j: number) => {
                          const isActive =
                            typeof r.hitIndex === "number" &&
                            r.hitIndex === (ctrl as any).activeHit;
                          
                          // FIX FOR CANVA: offset applied here
                          const shiftY = r.h * 0.65; 
                          const shrinkH = 0.75;

                          return (
                            <div
                              key={j}
                              className={`hl${
                                isActive ? " is-active" : ""
                              }`}
                              style={{
                                position: "absolute",
                                left: `${r.x * 100}%`,
                                top: `${(r.y + shiftY) * 100}%`,
                                width: `${r.w * 100}%`,
                                height: `${(r.h * shrinkH) * 100}%`,
                              }}
                            />
                          );
                        })}
                      </div>
                      {/* === /HIGHLIGHTS LAYER === */}

                      {/* === BOOKMARK TABS === */}
                      {bmSorted
                        .filter((b) => b.page === pageNum)
                        .map((bm) => {
                          const i = bmIndex.get(bm.id) ?? 0;
                          const curr = ctrl.currentIndex + 1;
                          const leftNow = ctrl.single
                            ? curr
                            : curr % 2 === 0
                            ? curr
                            : curr - 1;
                          const rightNow = Math.min(leftNow + 1, ctrl.totalPages);
                          const isCurrentLeft = pageNum === leftNow;
                          const isCurrentRight = pageNum === rightNow;
                          const sideIsLeft = ctrl.single
                            ? bm.page < curr
                            : bm.page <= leftNow;
                          const shouldAttach =
                            (isCurrentLeft && sideIsLeft) ||
                            (isCurrentRight && !sideIsLeft);

                          if (!shouldAttach) return null;
                          const ACTIVE_SCALE = 1.14;

                          const style: React.CSSProperties = {
                            position: "absolute",
                            zIndex: 300,
                            top: `calc(var(--tabTop,36px) + ${i} * var(--tabLength,140px) * var(--bm-step,1))`,
                            width: "var(--tabThickness,36px)",
                            height: "var(--tabLength,140px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: 16,
                            fontWeight: 500,
                            lineHeight: 1,
                            border: "1px solid rgba(0,0,0,.18)",
                            boxShadow: "0 2px 6px rgba(0,0,0,.12)",
                            opacity: 0.98,
                            pointerEvents: "auto",
                            background: bm.color || "#f47e20",
                            ...(isCurrentLeft
                              ? {
                                  left: 0,
                                  transformOrigin: "right center",
                                  transform: "translateZ(0.01px) translateX(var(--tabInset,-35px)) scaleX(" + ACTIVE_SCALE + ")",
                                  borderRadius: "10px 0 0 10px",
                                }
                              : {
                                  right: 0,
                                  transformOrigin: "left center",
                                  transform: "translateZ(0.01px) translateX(calc(-1 * var(--tabInset,-35px))) scaleX(" + ACTIVE_SCALE + ")",
                                  borderRadius: "0 10px 10px 0",
                                }),
                          };

                          return (
                            <button
                              key={bm.id}
                              className={`bm-tab ${sideIsLeft ? "left" : "right"} active`}
                              title={`${bm.label} (p.${bm.page})`}
                              style={style}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                jumpToPdfPage(bm.page ?? 1);
                              }}
                            >
                              <span className="bm-tab__label">{bm.label}</span>
                            </button>
                          );
                        })}

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

            {/* підказка загнутого кутика (правий-нижній) */}
            {ctrl.canNext && <div className="page-curl-hint" aria-hidden />}
     
            {ctrl.canPrev && <div className="page-curl-hint left" aria-hidden />}
            

            {/* === ALWAYS-VISIBLE RAILS === */}
            {bmSorted.length > 0 && (
              <div className="bm-rails" aria-hidden={false}>
                {/* ліва рейка */}
                <div className="bm-rail left">
                  {(() => {
                    const curr = ctrl.currentIndex + 1;
                    const leftNow = ctrl.single
                      ? curr
                      : curr % 2 === 0
                      ? curr
                      : curr - 1;

                    const leftBookmarks = bmSorted.filter(
                      (bm) => bm.page < leftNow
                    );

                    return leftBookmarks.map((bm, idx) => {
                      const pos = bmIndex.get(bm.id) ?? idx;

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
                              zIndex: 1000 - pos,
                            } as React.CSSProperties
                          }
                        >
                          <span className="bm-tab__label">{bm.label}</span>
                        </button>
                      );
                    });
                  })()}
                </div>

                {/* права рейка */}
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

                    const rightBookmarks = bmSorted.filter(
                      (bm) => bm.page > rightNow
                    );

                    return rightBookmarks.map((bm, idx) => {
                      const pos = bmIndex.get(bm.id) ?? idx;

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
                              zIndex: 1000 - pos,
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

            {/* Кутові хендли */}
            <div className="flip-handles" aria-hidden>
              <button
                className="fh tl"
                onMouseDown={(e) => {
                  e.preventDefault();
                  playFlip();
                  (ctrl.bookRef.current as any)?.pageFlip?.().flipPrev();
                }}
              />
              <button
                className="fh bl"
                onMouseDown={(e) => {
                  e.preventDefault();
                  playFlip();
                  (ctrl.bookRef.current as any)?.pageFlip?.().flipPrev();
                }}
              />
              <button
                className="fh tr"
                onMouseDown={(e) => {
                  e.preventDefault();
                  playFlip();
                  (ctrl.bookRef.current as any)?.pageFlip?.().flipNext();
                }}
              />
              <button
                className="fh br"
                onMouseDown={(e) => {
                  e.preventDefault();
                  playFlip();
                  (ctrl.bookRef.current as any)?.pageFlip?.().flipNext();
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* === RIGHT SEARCH FLYOUT === */}
      {q.trim().length > 0 && (
        <aside
          className="search-flyout"
          role="region"
          aria-label="Search results"
        >
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
                className={`sf-item${
                  i === ctrl.activeHit ? " is-active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  playFlip();

                  const target = Math.max(0, (h.page ?? 1) - 1);
                  if (ctrl.currentIndex === target) {
                    ctrl.setActiveHit(i);
                    return;
                  }

                  ctrl.setActiveHit(i);
                  ctrl.setCurrentIndex(target);

                  setTimeout(() => {
                    const api = (ctrl.bookRef.current as any)?.pageFlip?.();
                    if (api?.turnToPage) {
                      api.turnToPage(target);
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
        goFirst={footerApi.goFirst}
        goPrev={footerApi.goPrev}
        goNext={footerApi.goNext}
        goLast={footerApi.goLast}
        pageJump={ctrl.pageJump}
        setPageJump={ctrl.setPageJump}
        submitJump={footerApi.submitJump}
        loupeOn={ctrl.loupeOn}
        setLoupeOn={ctrl.setLoupeOn}
        loupeState={ctrl.loupe}
        LOUPE_SIZE={ctrl.LOUPE_SIZE}
        LOUPE_ZOOM={ctrl.LOUPE_ZOOM}
        soundMuted={soundMuted}
        toggleSound={toggleSound}
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
          --tabThickness: 36px; /* ширина вкладки */
          --tabLength: 140px; /* висота вкладки */
          --tabGap: 0px; /* НУЛЬОВИЙ проміжок, йдуть «встик» */
          --tabTop: 36px;
          --tabInset: calc(-1 * var(--tabThickness));
          --bm-step: 1; /* множник кроку між вкладками, JS може змінити */

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
        button[aria-label="Publish"] {
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
          justifyContent: center;
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
          width: min(290px, 92vw);
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
  font-weight: 500;
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

/* активна вкладка завжди вище за рейки */
.bm-tab.active {
  z-index: 260;
}

.bm-tab__label {
  writing-mode: vertical-rl; /* базово зверху вниз */
  text-orientation: mixed;
  max-height: calc(var(--tabLength) - 10px);
  padding: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.08em;
  display: inline-block;
}

/* Права сторона — як є, згори вниз */
.bm-tab.right .bm-tab__label {
  transform: none;
}

/* Ліва сторона — тільки текст розвертаємо, знизу вгору */
.bm-tab.left .bm-tab__label {
  transform: rotate(180deg);
}

/* =========================================
 * 9) BOOKMARK RAILS (ALWAYS VISIBLE)
 * =======================================*/
.bm-rails {
  position: absolute;
  inset: 0;
  z-index: 180;            /* нижче за .bm-tab.active */
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
          content: "";
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

        /* ===== Page corner “curl” hint — Realistic Peel ===== */
.page-curl-hint {
  --curl-max: 90px;
  position: absolute;
  right: 0; bottom: 0;
  width: var(--curl-max);
  height: var(--curl-max);
  pointer-events: none;
  z-index: 80;
  overflow: visible; 
}

/* «Пелюстка» */
.page-curl-hint::before {
  content: "";
  position: absolute;
  right: 0; bottom: 0;
  
  width: 0; /* Початковий стан — приховано */
  height: 0;
  
  background: linear-gradient(
    135deg,
    #ffffff 45%,
    #f0f0f0 50%,
    #d9d9d9 55%,
    transparent 56%
  );
  
  box-shadow: -4px -4px 12px rgba(0, 0, 0, 0.3);
  border-bottom-right-radius: 0;
  border-top-left-radius: 100px;
  
  /* ЗМІНА ТУТ: 
     Загальний цикл 7 секунд. 
     З них ~2.5 сек — рух, ~4.5 сек — пауза. */
  animation: curlPulse 7s ease-in-out infinite;
}

/* Стрілка */
.page-curl-hint::after {
  content: "";
  position: absolute;
  z-index: 81;
  right: 4px; bottom: 4px;
  width: 12px; height: 12px;
  
  border-right: 3px solid rgba(0,0,0,0.6);
  border-top: 3px solid rgba(0,0,0,0.6);
  transform: rotate(45deg);
  
  opacity: 0;
  /* ЗМІНА ТУТ: теж 7 секунд, щоб синхронізуватися */
  animation: arrowMove 7s ease-in-out infinite;
}

.page-curl-hint.left {
  right: auto; left: 0;
  transform: scaleX(-1);
}

/* Зупинка при наведенні */
.page-curl-hint:hover::before,
.page-curl-hint:hover::after,
.viewer:hover .page-curl-hint::before,
.viewer:hover .page-curl-hint::after {
  animation-play-state: paused;
  width: var(--curl-max);
  height: var(--curl-max);
  opacity: 1;
  transition: width 0.3s, height 0.3s;
}

/* ===== ОНОВЛЕНІ KEYFRAMES ===== */

@keyframes curlPulse {
  /* 0% - 40%: Активна фаза (приблизно 2.8 сек) */
  0% {
    width: 0; 
    height: 0;
    border-top-left-radius: 0;
  }
  20% { /* Пік анімації */
    width: var(--curl-max); 
    height: var(--curl-max);
    border-top-left-radius: 50px;
  }
  40% { /* Повернення назад */
    width: 0; 
    height: 0;
    border-top-left-radius: 0;
  }
  /* 40% - 100%: Пауза (нічого не відбувається до кінця 7-ї секунди) */
  100% {
    width: 0; 
    height: 0;
    border-top-left-radius: 0;
  }
}

@keyframes arrowMove {
  /* Синхронізовано з curlPulse */
  0% {
    transform: translate(0, 0) rotate(45deg);
    opacity: 0;
  }
  10% { /* З'являється трохи швидше */
    opacity: 1;
  }
  20% { /* Пік руху */
    transform: translate(-30px, -30px) rotate(45deg);
    opacity: 0.6;
  }
  35% { /* Зникає трохи раніше, ніж закриється кут */
    opacity: 0;
  }
  /* Пауза */
  100% {
    transform: translate(0, 0) rotate(45deg);
    opacity: 0;
  }
}

/* Доступність */
@media (prefers-reduced-motion: reduce) {
  .page-curl-hint::before, .page-curl-hint::after {
    animation: none !important;
    width: 40px; height: 40px;
    opacity: 1;
  }
}


      `}</style>
    </div>
  );
}
