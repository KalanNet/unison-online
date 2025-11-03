"use client";

import React, { useState, useEffect } from "react";

type Hit = { id: string; page: number; snippet: string };

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

  /** поки splashActive — не показуємо бургер і дії */
  splashActive?: boolean;
};

export default function MobileHeader(p: Props) {
  const [open, setOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function submit() {
    p.runSearch(p.searchQuery);
    setShowResults(true);
  }

  const showActions = mounted && !p.splashActive;

  return (
    <>
      <header className="mheader">
        <div className="mh-title" title={p.title}>{p.title}</div>
        {showActions && (
          <button className="mh-burger" onClick={() => setOpen(true)} aria-label="Menu">
            <span/><span/><span/>
          </button>
        )}
      </header>

      {open && (
        <div className="mh-drawer" role="dialog" aria-modal="true">
          <div className="mh-dim" onClick={() => { setOpen(false); setShowResults(false); }} />
          <div className="mh-panel">
            <div className="mh-row">
              <input
                className="mh-inp"
                placeholder="Search…"
                value={p.searchQuery}
                onChange={(e) => p.setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
              <button
                className="mh-btn ghost"
                onClick={() => { p.setSearchQuery(""); setShowResults(false); }}
                aria-label="Clear"
                title="Clear"
              >✕</button>
            </div>

            <div className="mh-actions">
              <a className="mh-ib" href={p.file} download title="Download PDF">
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 21h16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </svg>
              </a>
              <button className="mh-ib" onClick={p.onShare} title="Share">
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <path d="M12 16V4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <path d="M8 8l4-4 4 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {showResults && (
              <div className="mh-results">
                {p.hits.slice(0, 100).map((h) => (
                  <button
                    key={h.id}
                    className="mh-res"
                    onClick={() => { p.onGoto(h.page); setOpen(false); setShowResults(false); }}
                    title={`Go to p.${h.page}`}
                  >
                    <b>p.{h.page}</b> <span>{h.snippet}</span>
                  </button>
                ))}
                {!p.hits.length && <div className="mh-empty">No results yet</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .mheader{ position:sticky; top:0; z-index:30; background:#fafbf8; border-bottom:1px solid #e9ede3; padding:8px 10px; display:flex; align-items:center; gap:8px; }
        .mh-title{ font-weight:900; color:#2d3018; font-size:15px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .mh-burger{ margin-left:auto; width:36px; height:36px; border:1px solid #e7ebdf; border-radius:.6rem; background:#fff; display:grid; place-items:center; }
        .mh-burger span{ width:16px; height:2px; background:#2d3018; display:block; border-radius:2px; }
        .mh-burger span + span{ margin-top:3px; }

        .mh-drawer{ position:fixed; inset:0; z-index:50; }
        .mh-dim{ position:absolute; inset:0; background:rgba(0,0,0,.25); }
        .mh-panel{ position:absolute; left:0; top:0; bottom:0; width:75vw; max-width:480px; background:#fff; box-shadow: 8px 0 28px rgba(0,0,0,.2); padding:14px; display:flex; flex-direction:column; gap:10px; }

        .mh-row{ display:flex; gap:6px; }
        .mh-inp{ flex:1; border:1px solid #e7ebdf; border-radius:.6rem; padding:.5rem .65rem; }
        .mh-btn{ border:1px solid #e7ebdf; border-radius:.6rem; padding:.5rem .75rem; background:#fff; font-weight:700; }
        .mh-btn.ghost{ background:#f8f8f6; }
        .mh-actions{ display:flex; gap:10px; }
        .mh-ib{ background:#fff; border:1px solid #e7ebdf; border-radius:.7rem; width:42px; height:42px; display:grid; place-items:center; color:#2d3018; }
        .mh-results{ overflow:auto; border-top:1px solid #eef0ea; padding-top:10px; display:flex; flex-direction:column; gap:6px; }
        .mh-res{ text-align:left; border:1px solid #eef0ea; border-radius:.6rem; padding:.55rem .65rem; background:#fff; font-size:14px; }
        .mh-res b{ margin-right:.4rem; }
        .mh-empty{ color:#6b735f; font-size:12px; }
      `}</style>
    </>
  );
}
