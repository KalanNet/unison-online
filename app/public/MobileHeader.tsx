"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Hit = { id: string; page: number; snippet: string };
type Bookmark = { id: string; page: number; label: string; color?: string | null };

type Props = {
  title: string;
  file: string;

  searchQuery: string;
  setSearchQuery: (v: string) => void;
  runSearch: (q: string) => void;
  searching: boolean;
  hits: Hit[];
  onGoto: (p: number) => void;

  onShare: () => void;
  bookmarks?: Bookmark[];
  splashActive?: boolean;
};

export default function MobileHeader(p: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const showActions = mounted && !p.splashActive;
  const hasQuery = p.searchQuery.trim().length > 0;

  const bmSorted = useMemo(
    () => [...(p.bookmarks ?? [])].sort((a, b) => a.page - b.page),
    [p.bookmarks]
  );

  /* ---------- HW Back: рівно один раз ---------- */
  const pushedRef = useRef(false);
  useEffect(() => {
    if (!open) return;

    // штовхаємо РІВНО один запис
    if (!pushedRef.current) {
      try { history.pushState({ __mh: 1 }, ""); pushedRef.current = true; } catch {}
    }

    const onPop = () => {
      // прийшов popstate → просто закриваємо і скидаємо прапорець
      pushedRef.current = false;
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  // централізоване закриття (прибирає наш запис з історії, якщо він є)
  const closePanel = () => {
    if (pushedRef.current) {
      pushedRef.current = false;
      try { history.back(); return; } catch {}
    }
    setOpen(false);
  };

  /* ---------- ESC ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    window.addEventListener("keydown", onKey, { passive: true });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- Swipe-down (лише з top-handle і коли не скролиться) ---------- */
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null); // скролювана зона
  useEffect(() => {
    if (!open || !panelRef.current) return;
    let y0 = 0, dy = 0, tracking = false;

    const onStart = (e: TouchEvent) => {
      const panel = panelRef.current!;
      const rect = panel.getBoundingClientRect();
      const touchY = e.touches[0].clientY;

      // старт тільки в «хендлі» зверху (24px)
      const startInHandle = touchY - rect.top <= 24;

      // і тільки якщо контент прокручений до самого верху
      const atTop = (contentRef.current?.scrollTop ?? 0) === 0;

      tracking = startInHandle && atTop;
      if (tracking) { y0 = touchY; dy = 0; }
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      dy = e.touches[0].clientY - y0;
    };
    const onEnd = () => {
      if (tracking && dy > 60) closePanel();
      tracking = false;
    };

    const el = panelRef.current;
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove",  onMove,  { passive: true });
    el.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove",  onMove);
      el.removeEventListener("touchend",   onEnd);
    };
  }, [open]);

  return (
    <>
      <header className="mheader">
        <div className="mh-title" title={p.title}>{p.title}</div>
        {showActions && (
          <button className="mh-burger" onClick={() => setOpen(true)} aria-label="Menu" title="Menu">
            <span/><span/><span/>
          </button>
        )}
      </header>

      {open && (
        <div className="mh-drawer" role="dialog" aria-modal="true">
          <div className="mh-dim" onClick={closePanel} />
          <div ref={panelRef} className="mh-panel">
            {/* top handle, щоб підказати про свайп */}
            <div className="mh-handle" aria-hidden />

            {/* 1) Search input — ЗАВЖДИ угорі */}
            <div className="mh-row">
              <div className="mh-inp-wrap">
                <input
                  className="mh-inp"
                  placeholder="Search…"
                  value={p.searchQuery}
                  onChange={(e) => p.setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") p.runSearch(p.searchQuery); }}
                  aria-label="Search"
                />
                {hasQuery && (
                  <button
                    className="mh-clear"
                    aria-label="Clear search"
                    title="Clear"
                    onClick={() => p.setSearchQuery("")}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* 2) Контент під інпутом: або RESULTS, або BOOKMARKS */}
            <div ref={contentRef} className="mh-content">
              {hasQuery || p.searching ? (
                <>
                  <div className="mh-sec-hd">Search results</div>
                  <div className="mh-list">
                    {p.searching && <div className="mh-empty">Searching…</div>}
                    {!p.searching && p.hits.length === 0 && <div className="mh-empty">No matches.</div>}
                    {!p.searching &&
                      p.hits.map((h) => (
                        <button
                          key={h.id}
                          className="mh-item"
                          onClick={() => { p.onGoto(h.page); closePanel(); }}
                          title={`Go to p.${h.page}`}
                        >
                          <b>p.{h.page}</b> <span>{h.snippet}</span>
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mh-sec-hd">Bookmarks</div>
                  <div className="mh-list">
                    {bmSorted.length === 0 ? (
                      <div className="mh-empty">No bookmarks yet.</div>
                    ) : (
                      bmSorted.map((b) => (
                        <button
                          key={b.id}
                          className="mh-bm"
                          onClick={() => { p.onGoto(b.page); closePanel(); }}
                          title={`Go to p.${b.page}`}
                        >
                          <span className="mh-dot" style={{ background: b.color || "#f47e20" }} />
                          <span className="mh-bm-title">{b.label}</span>
                          <span className="mh-bm-meta">p.{b.page}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 3) Close внизу */}
            <div className="mh-close-wrap">
              <button className="mh-close-btn" type="button" onClick={closePanel} aria-label="Close menu" title="Close">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .mheader{ position:sticky; top:0; z-index:30; background:#fafbf8; border-bottom:0px solid #e9ede3; padding:8px 10px; display:flex; align-items:center; gap:8px; height:56px; }
        .mh-title{ font-weight:900; color:#2d3018; font-size:15px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .mh-burger{ margin-left:auto; width:40px; height:40px; border:1px solid #dcded5; border-radius:.5rem; background:#fff; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:5px; }
        .mh-burger span{ width:22px; height:3px; background:#2d3018; border-radius:3px; display:block; }

        .mh-drawer{ position:fixed; inset:0; z-index:50; }
        .mh-dim{ position:absolute; inset:0; background:rgba(0,0,0,.25); }
        .mh-panel{
          position:absolute; right:0; top:0; bottom:0; width:75vw; max-width:480px;
          background:#fff; color:#2d3018; box-shadow:-8px 0 28px rgba(0,0,0,.2);
          padding:10px 14px 14px; display:flex; flex-direction:column; gap:12px;
          border-left:1px solid #e7ebdf; border-radius:12px 0 0 12px;
        }
        .mh-handle{
          height: 14px;
          display: grid;
          place-items: center;
        }
        .mh-handle::before{
          content:"";
          width: 44px;
          height: 4px;
          border-radius: 999px;
          background: #e8eadf;
          display:block;
        }

        .mh-row{ display:flex; gap:6px; }
        .mh-inp-wrap{ position:relative; width:100%; }
        .mh-inp{
          width:100%; border:1px solid #e7ebdf; border-radius:.6rem; padding:.55rem .9rem;
          padding-right:2.0rem; background:#fafbf8;
        }
        .mh-clear{
          position:absolute; right:.35rem; top:50%; transform:translateY(-50%);
          width:28px; height:28px; border-radius:8px; border:1px solid #e7ebdf;
          background:#fff; font-weight:900; line-height:1; display:grid; place-items:center;
        }

        .mh-content{ flex:1 1 auto; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:10px; padding-right:2px; }
        .mh-sec-hd{ font-weight:800; }
        .mh-list{ display:flex; flex-direction:column; gap:8px; }
        .mh-empty{ color:#6b735f; font-size:12px; padding:6px 2px; }

        .mh-item{ text-align:left; border:1px solid #eef0ea; border-radius:.6rem; padding:.55rem .65rem; background:#fff; font-size:14px; display:block; }
        .mh-item b{ margin-right:.4rem; }

        .mh-bm{ border:1px solid #eef0ea; background:#fff; border-radius:.6rem; padding:.55rem .65rem; display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; text-align:left; }
        .mh-dot{ width:12px; height:12px; border-radius:999px; border:1px solid rgba(0,0,0,.12); }
        .mh-bm-title{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .mh-bm-meta{ color:#6b735f; font-size:12px; }

        .mh-close-wrap{ padding-top:2px; }
        .mh-close-btn{
          width:100%; padding:.6rem .9rem; border:1px solid #e7ebdf; border-radius:.65rem;
          background:#fff; font-weight:800; color:#2d3018; box-shadow:0 4px 12px rgba(0,0,0,.06);
        }
        .mh-close-btn:active{ transform:translateY(0.5px); }
      `}</style>
    </>
  );
}
