// app/(public)/MobileHeader.tsx
"use client";

import React, { useEffect, useState } from "react";

type Hit = { id: string; page: number; snippet: string };

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

            <div className="mh-actions">
              <a className="mh-ib" href={p.file} download title="Download PDF" aria-label="Download PDF">
                ⬇
              </a>
              <button className="mh-ib" onClick={p.onShare} title="Share" aria-label="Share">
                ⤴
              </button>
            </div>

            {/* РЕЗУЛЬТАТИ — НЕ видаляємо ані при кліку, ані при закритті панелі */}
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
                      // переходимо на сторінку, але НЕ очищаємо запит/результати
                      p.onGoto(h.page);
                      setOpen(false); // панель можна закрити, дані лишаються
                    }}
                    title={`Go to p.${h.page}`}
                  >
                    <b>p.{h.page}</b> <span>{h.snippet}</span>
                  </button>
                ))
              )}
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
          border-radius: 0.5rem;
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

        .mh-drawer {
          position: fixed;
          inset: 0;
          z-index: 50;
        }
        .mh-dim {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.25);
        }

        /* ПАНЕЛЬ СПРАВА */
        .mh-panel {
          position: absolute;
          right: 0;              /* ← правий край */
          top: 0;
          bottom: 0;
          width: 75vw;
          max-width: 480px;
          background: #fff;
          box-shadow: -8px 0 28px rgba(0, 0, 0, 0.2); /* тінь зліва від панелі */
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-left: 1px solid #e7ebdf;
          border-radius: 12px 0 0 12px;
        }

        .mh-row {
          display: flex;
          gap: 6px;
        }
        .mh-inp {
          flex: 1;
          border: 1px solid #e7ebdf;
          border-radius: 0.6rem;
          padding: 0.5rem 0.65rem;
        }
        .mh-btn {
          border: 1px solid #e7ebdf;
          border-radius: 0.6rem;
          padding: 0.5rem 0.75rem;
          background: #fff;
          font-weight: 700;
        }
        .mh-actions {
          display: flex;
          gap: 10px;
        }
        .mh-ib {
          background: #fff;
          border: 1px solid #e7ebdf;
          border-radius: 0.7rem;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          color: #2d3018;
        }
        .mh-results {
          overflow: auto;
          border-top: 1px solid #eef0ea;
          padding-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mh-res {
          text-align: left;
          border: 1px solid #eef0ea;
          border-radius: 0.6rem;
          padding: 0.55rem 0.65rem;
          background: #fff;
          font-size: 14px;
        }
        .mh-res b {
          margin-right: 0.4rem;
        }
        .mh-empty {
          color: #6b735f;
          font-size: 12px;
        }
      `}</style>
    </>
  );
}
