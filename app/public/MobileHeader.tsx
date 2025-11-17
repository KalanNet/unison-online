"use client";

import React, { useEffect, useState } from "react";

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey, { passive: true });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showActions = mounted && !p.splashActive;
  const bmSorted = React.useMemo(
    () => [...(p.bookmarks ?? [])].sort((a, b) => a.page - b.page),
    [p.bookmarks]
  );

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
          <div className="mh-dim" onClick={() => setOpen(false)} />
          <div className="mh-panel">
            {/* ЄДИНИЙ пошук зверху */}
            <div className="mh-row">
              <input
                className="mh-inp"
                placeholder="Search…"
                value={p.searchQuery}
                onChange={(e) => p.setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") p.runSearch(p.searchQuery); }}
                aria-label="Search"
              />
            </div>

            {/* Результати показуємо тільки коли вони справді є */}
            {p.hits.length > 0 && (
              <div className="mh-section">
                <div className="mh-sec-hd">Search results</div>
                <div className="mh-list">
                  {p.hits.slice(0, 200).map((h) => (
                    <button
                      key={h.id}
                      className="mh-item"
                      onClick={() => { p.onGoto(h.page); setOpen(false); }}
                      title={`Go to p.${h.page}`}
                    >
                      <b>p.{h.page}</b> <span>{h.snippet}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Закладки */}
            <div className="mh-section">
              <div className="mh-sec-hd">Bookmarks</div>
              <div className="mh-list">
                {bmSorted.length === 0 ? (
                  <div className="mh-empty">No bookmarks yet.</div>
                ) : (
                  bmSorted.map((b) => (
                    <button
                      key={b.id}
                      className="mh-item"
                      onClick={() => { p.onGoto(b.page); setOpen(false); }}
                      title={`Go to p.${b.page}`}
                    >
                      <span className="mh-dot" style={{ background: b.color || "#f47e20" }} />
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
        .mheader{ position:sticky; top:0; z-index:30; background:#fafbf8; border-bottom:1px solid #e9ede3; padding:8px 10px; display:flex; align-items:center; gap:8px; height:56px; }
        .mh-title{ font-weight:900; color:#2d3018; font-size:15px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .mh-burger{ margin-left:auto; width:40px; height:40px; border:1px solid #dcded5; border-radius:.5rem; background:#fff; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:5px; }
        .mh-burger span{ width:22px; height:3.5px; background:#2d3018; border-radius:3px; display:block; }

        .mh-drawer{ position:fixed; inset:0; z-index:50; }
        .mh-dim{ position:absolute; inset:0; background:rgba(0,0,0,.25); }

        .mh-panel{ position:absolute; right:0; top:0; bottom:0; width:75vw; max-width:480px; background:#fff; box-shadow:-8px 0 28px rgba(0,0,0,.2); padding:14px; display:flex; flex-direction:column; gap:14px; border-left:1px solid #e7ebdf; border-radius:12px 0 0 12px; }

        .mh-row{ display:flex; gap:6px; }
        .mh-inp{ flex:1; border:1px solid #e7ebdf; border-radius:.6rem; padding:.5rem .65rem; }

        .mh-section{ display:flex; flex-direction:column; gap:8px; }
        .mh-sec-hd{ font-weight:800; color:#2d3018; }
        .mh-list{ max-height:40vh; overflow:auto; display:flex; flex-direction:column; gap:6px; }
        .mh-item{ text-align:left; border:1px solid #eef0ea; border-radius:.6rem; padding:.55rem .65rem; background:#fff; font-size:14px; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:8px; }
        .mh-item b{ margin-right:.4rem; }
        .mh-dot{ width:12px; height:12px; border-radius:999px; border:1px solid rgba(0,0,0,.12); }
        .mh-bm-title{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .mh-bm-meta{ color:#6b735f; font-size:12px; }
        .mh-empty{ color:#6b735f; font-size:12px; }
      `}</style>
    </>
  );
}
