"use client";

import React, { useEffect, useState } from "react";

type Hit = { id: string; page: number; snippet: string };
type Bookmark = { id: string; page: number; label: string; color?: string | null };

type Props = {
  title: string;
  file: string;

  // search state
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  runSearch: (q: string) => void;
  searching: boolean;
  hits: Hit[];
  onGoto: (p: number) => void;

  onShare: () => void;

  /** мобільні закладки */
  bookmarks?: Bookmark[];

  /** поки splashActive — не показуємо бургер і дії */
  splashActive?: boolean;
};

export default function MobileHeader(p: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ESC — просто закриває панель (нічого не очищаємо)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey, { passive: true });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit() {
    p.runSearch(p.searchQuery);
  }

  const hasQuery = p.searchQuery.trim().length > 0;
  const showActions = mounted && !p.splashActive;

  // відсортовані закладки
  const bmSorted = React.useMemo(
    () => [...(p.bookmarks ?? [])].sort((a, b) => a.page - b.page),
    [p.bookmarks]
  );

  return (
    <>
      <header className="mheader">
        <div className="mh-title" title={p.title}>
          {p.title}
        </div>
        {showActions && (
          <button
            className="mh-burger"
            onClick={() => setOpen(true)}
            aria-label="Menu"
            title="Menu"
          >
            <span />
            <span />
            <span />
          </button>
        )}
      </header>

      {open && (
        <div className="mh-drawer" role="dialog" aria-modal="true">
          {/* бекдроп — закриває, але НЕ чистить пошук/результати */}
          <div className="mh-dim" onClick={() => setOpen(false)} />

          {/* ПРАВА панель */}
          <div className="mh-panel">
            {/* Search */}
            <div className="mh-row">
              <input
                className="mh-inp"
                placeholder="Search…"
                value={p.searchQuery}
                onChange={(e) => p.setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              <button
                className="mh-btn"
                onClick={submit}
                disabled={p.searching}
                aria-label="Search"
                title="Search"
              >
                {p.searching ? "…" : "Go"}
              </button>
            </div>

            {/* Швидкі дії */}
            <div className="mh-actions">
              <a className="mh-ib" href={p.file} download title="Download PDF" aria-label="Download PDF">
                ⬇
              </a>
              <button className="mh-ib" onClick={p.onShare} title="Share" aria-label="Share">
                ⤴
              </button>
            </div>

            {/* РЕЗУЛЬТАТИ ПОШУКУ */}
            <div className="mh-section">
              <div className="mh-sec-hd">Search results</div>
              <div className="mh-results">
                {!hasQuery ? (
                  <div className="mh-empty">Type to search…</div>
                ) : p.searching ? (
                  <div className="mh-empty">Searching…</div>
                ) : p.hits.length === 0 ? (
                  <div className="mh-empty">No matches.</div>
                ) : (
                  p.hits.slice(0, 200).map((h) => (
                    <button
                      key={h.id}
                      className="mh-res"
                      onClick={() => {
                        p.onGoto(h.page);     // перехід
                        setOpen(false);       // панель можна закрити (стан збережеться)
                      }}
                      title={`Go to p.${h.page}`}
                    >
                      <b>p.{h.page}</b> <span>{h.snippet}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* ЗАКЛАДКИ */}
            <div className="mh-section">
              <div className="mh-sec-hd">Bookmarks</div>
              <div className="mh-bookmarks">
                {bmSorted.length === 0 ? (
                  <div className="mh-empty">No bookmarks yet.</div>
                ) : (
                  bmSorted.map((b) => (
                    <button
                      key={b.id}
                      className="mh-bm"
                      onClick={() => {
                        p.onGoto(b.page);
                        setOpen(false);
                      }}
                      title={`Go to p.${b.page}`}
                    >
                      <span
                        className="mh-dot"
                        style={{ background: b.color || "#f47e20" }}
                      />
                      <span className="mh-bm-title">{b.label}</span>
                      <span className="mh-bm-meta">p.{b.page}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .mheader {
          position: sticky;
          top: 0;
          z-index: 30;
          background: #fafbf8;
          border-bottom: 1px solid #e9ede3;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          height: 56px;
        }
        .mh-title {
          font-weight: 900;
          color: #2d3018;
          font-size: 15px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .mh-burger {
          margin-left: auto;
          width: 40px;
          height: 40px;
          border: 1px solid #dcded5;
          border-radius: .5rem;
          background: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 5px;
        }
        .mh-burger span {
          width: 22px;
          height: 3.5px;
          background: #2d3018;
          border-radius: 3px;
          display: block;
        }

        .mh-drawer { position: fixed; inset: 0; z-index: 50; }
        .mh-dim { position: absolute; inset: 0; background: rgba(0,0,0,.25); }

        /* ПАНЕЛЬ СПРАВА */
        .mh-panel {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 75vw;
          max-width: 480px;
          background: #fff;
          box-shadow: -8px 0 28px rgba(0,0,0,.2);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          border-left: 1px solid #e7ebdf;
          border-radius: 12px 0 0 12px;
        }

        .mh-row { display: flex; gap: 6px; }
        .mh-inp { flex: 1; border: 1px solid #e7ebdf; border-radius: .6rem; padding: .5rem .65rem; }
        .mh-btn { border: 1px solid #e7ebdf; border-radius: .6rem; padding: .5rem .75rem; background: #fff; font-weight: 700; }
        .mh-actions { display: flex; gap: 10px; }
        .mh-ib { background:#fff; border:1px solid #e7ebdf; border-radius:.7rem; width:42px; height:42px; display:grid; place-items:center; color:#2d3018; }

        .mh-section { display:flex; flex-direction:column; gap:8px; }
        .mh-sec-hd { font-weight:800; color:#2d3018; }

        .mh-results, .mh-bookmarks {
          max-height: 35vh;
          overflow: auto;
          border: 1px solid #eef0ea;
          border-radius: .7rem;
          padding: 8px;
          display: flex; flex-direction: column; gap: 6px;
          background: #fafafa;
        }

        .mh-res, .mh-bm {
          text-align: left;
          border: 1px solid #eef0ea;
          border-radius: .6rem;
          padding: .55rem .65rem;
          background: #fff;
          font-size: 14px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 8px;
        }
        .mh-res b { margin-right: .4rem; grid-column: 1 / 2; }
        .mh-res span { grid-column: 2 / -1; }

        .mh-dot { width:12px; height:12px; border-radius:999px; border:1px solid rgba(0,0,0,.12); }
        .mh-bm-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .mh-bm-meta { color:#6b735f; font-size:12px; }

        .mh-empty { color:#6b735f; font-size:12px; }
      `}</style>
    </>
  );
}
