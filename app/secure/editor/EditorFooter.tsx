// app/secure/editor/EditorFooter.tsx
"use client";

import React from "react";
import { createPortal } from "react-dom";

type LoupeState = {
  visible: boolean; clientX: number; clientY: number; imgRect: DOMRect | null;
  contentW: number; contentH: number; offsetX: number; offsetY: number; url: string;
};

type Props = {
  refEl: React.RefObject<HTMLDivElement | null>; isNarrow: boolean;
  numPages: number; currentIndex: number; canPrev: boolean; canNext: boolean;
  goFirst: () => void; goPrev: () => void; goNext: () => void; goLast: () => void;
  pageJump: string; setPageJump: React.Dispatch<React.SetStateAction<string>>; submitJump: () => void;
  loupeOn: boolean; setLoupeOn: React.Dispatch<React.SetStateAction<boolean>>; loupeState: LoupeState;
  LOUPE_SIZE: number; LOUPE_ZOOM: number;
  /** 🔊 додано: опц. керування звуком (щоб не ламати існуючі виклики) */
  soundMuted?: boolean; toggleSound?: () => void;
};

/** Мінімалістична іконка звуку: хвилі → видимі коли не muted; діагональ → видима коли muted */
function IconSound({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.8v12.4L7.2 14.5H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      <path className={muted ? "snd-wave hidden" : "snd-wave"} d="M15.5 8.8c1.1 1.1 1.1 3.3 0 4.4M18 6.8c2.2 2.2 2.2 6.4 0 8.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path className={muted ? "snd-mute" : "snd-mute hidden"} d="M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function EditorFooter(p: Props) {
  return (
    <>
      <footer ref={p.refEl as any} className="local-footer viewer-toolbar shrink-0 z-20" role="toolbar" aria-label="Flipbook controls">
        <div className="toolbar-inner">
          <button className={`toolbtn ${p.currentIndex === 0 ? "disabled" : ""}`} onClick={p.goFirst} disabled={p.currentIndex === 0} title="First page" aria-label="First page">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M20 6l-9 6 9 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <button className={`toolbtn ${!p.canPrev ? "disabled" : ""}`} onClick={p.goPrev} disabled={!p.canPrev} title="Previous" aria-label="Previous page">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <div className="page-jump">
            <input id="pageJump" inputMode="numeric" pattern="[0-9]*" className="jump-inp" value={p.pageJump}
                   onChange={(e) => p.setPageJump(e.target.value.replace(/[^\d]/g, ""))}
                   onKeyDown={(e) => { if (e.key === "Enter") p.submitJump(); }}
                   title="Enter page number" aria-label="Enter page number" />
            <div className="jump-total">/ <span className="jump-total-strong">{p.numPages}</span></div>
            {!p.isNarrow && (
              <button className="toolbtn slim" onClick={p.submitJump} title="Go" aria-label="Go to page">
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
          </div>

          <button className={`toolbtn ${!p.canNext ? "disabled" : ""}`} onClick={p.goNext} disabled={!p.canNext} title="Next" aria-label="Next page">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <button className={`toolbtn ${!p.canNext ? "disabled" : ""}`} onClick={p.goLast} disabled={!p.canNext} title="Last page" aria-label="Last page">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 19V5M4 18l9-6-9-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <button className={`toolbtn tool-zoom ${p.loupeOn ? "active" : ""}`} onClick={() => p.setLoupeOn((v) => !v)} aria-pressed={p.loupeOn} title={p.loupeOn ? "Disable magnifier" : "Enable magnifier"} aria-label="Toggle magnifier">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" fill="none"/>
              <path d="M20.5 20.5l-4.2-4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* 🔊 Desktop mute toggle (показуємо лише якщо передали toggleSound) */}
          {!p.isNarrow && p.toggleSound && (
            <button className={`toolbtn tool-sound ${p.soundMuted ? "muted" : ""}`} onClick={p.toggleSound}
                    aria-pressed={!!p.soundMuted} title={p.soundMuted ? "Unmute page flip sound" : "Mute page flip sound"}
                    aria-label={p.soundMuted ? "Unmute sound" : "Mute sound"}>
              <IconSound muted={!!p.soundMuted} />
            </button>
          )}
        </div>
      </footer>

      {/* Loupe Portal (desktop only) */}
      <LoupePortal enabled={!p.isNarrow && p.loupeOn} state={p.loupeState} size={p.LOUPE_SIZE} zoom={p.LOUPE_ZOOM} />

      <style jsx global>{`
        .viewer-toolbar{background:#ffffffef;backdrop-filter:blur(6px);border-top:1px solid #ecefe7;}
        .toolbar-inner{max-width:980px;margin:0 auto;display:flex;gap:.5rem;align-items:center;justify-content:center;padding:8px 12px;overflow-x:auto;}
        .toolbtn{height:36px;min-width:36px;padding:0 .5rem;display:inline-grid;place-items:center;border:1px solid #e6eadf;background:#fff;color:#2d3018;border-radius:.65rem;box-shadow:0 4px 12px rgba(0,0,0,.06);}
        .toolbtn.slim{min-width:32px;height:32px;}
        .toolbtn.disabled{opacity:.45;cursor:not-allowed;}
        .toolbtn.active{outline:2px solid #8ea05a33;}
        .page-jump{display:flex;align-items:center;gap:.4rem;background:#fff;border:1px solid #e7ebdf;border-radius:.8rem;padding:.2rem .35rem;}
        .jump-inp{width:72px;text-align:center;font-weight:800;border:1px solid #e7ebdf;border-radius:.5rem;padding:.3rem .35rem;color:#2d3018;height:32px;}
        .jump-total{color:#5c6750;}
        .jump-total-strong{font-weight:800;color:#000;}
        @media (max-width:600px){.tool-zoom{display:none!important;}}
        /* 🔊 sound toggle */
        .tool-sound.muted{opacity:.9;background:#fbfbfb;}
        .tool-sound .snd-wave.hidden,.tool-sound .snd-mute.hidden{display:none;}
        .portal-loupe{position:fixed;z-index:60;border-radius:999px;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,.24),inset 0 0 0 2px rgba(255,255,255,.9);pointer-events:none;background:#fff;contain:layout paint;will-change:transform;transform:translateZ(0);}
      `}</style>
    </>
  );
}

function LoupePortal(props:{enabled:boolean;state:LoupeState;size:number;zoom:number}) {
  if (typeof document==="undefined") return null;
  const {enabled,state,size,zoom}=props; if(!enabled||!state.visible||!state.imgRect) return null;
  const {clientX,clientY,imgRect,contentW,contentH,offsetX,offsetY,url}=state;
  const imgX=Math.max(0,Math.min(contentW,clientX-(imgRect.left+offsetX)));
  const imgY=Math.max(0,Math.min(contentH,clientY-(imgRect.top+offsetY)));
  const innerLeft=-(imgX*zoom-size/2); const innerTop=-(imgY*zoom-size/2);
  return createPortal(
    <div className="portal-loupe" style={{left:clientX-size/2,top:clientY-size/2,width:size,height:size}}>
      <img src={url} alt="" draggable={false} style={{position:"absolute",width:contentW*zoom,height:contentH*zoom,left:innerLeft,top:innerTop,pointerEvents:"none",userSelect:"none",maxWidth:"none",maxHeight:"none"}}/>
    </div>, document.body
  );
}
