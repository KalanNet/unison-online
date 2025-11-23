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

/** Мінімалістична іконка звуку: різні SVG для muted / unmuted */
function IconSound({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.1716 9.17117L21.8284 14.828M16.1716 14.828L21.8284 9.17117M7.4803 15.4065L9.15553 17.4796C10.0288 18.5603 10.4655 19.1006 10.848 19.1594C11.1792 19.2104 11.5138 19.092 11.7394 18.8443C12 18.5581 12 17.8634 12 16.4739V7.52526C12 6.13581 12 5.44109 11.7394 5.1549C11.5138 4.90715 11.1792 4.78884 10.848 4.83975C10.4655 4.89858 10.0288 5.43893 9.15553 6.51963L7.4803 8.59273C7.30388 8.81105 7.21567 8.92021 7.10652 8.99876C7.00982 9.06835 6.90147 9.1201 6.78656 9.15158C6.65687 9.1871 6.51652 9.1871 6.23583 9.1871H4.8125C4.0563 9.1871 3.6782 9.1871 3.37264 9.28804C2.77131 9.4867 2.2996 9.95841 2.10094 10.5597C2 10.8653 2 11.2434 2 11.9996C2 12.7558 2 13.1339 2.10094 13.4395C2.2996 14.0408 2.77131 14.5125 3.37264 14.7112C3.6782 14.8121 4.0563 14.8121 4.8125 14.8121H6.23583C6.51652 14.8121 6.65687 14.8121 6.78656 14.8476C6.90147 14.8791 7.00982 14.9308 7.10652 15.0004C7.21567 15.079 7.30388 15.1881 7.4803 15.4065Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18.82 4.68652C19.8191 5.61821 20.6167 6.74472 21.1636 7.99657C21.7105 9.24842 21.9952 10.5991 21.9999 11.9652C22.0047 13.3313 21.7295 14.6838 21.1914 15.9395C20.6532 17.1951 19.8635 18.3272 18.8709 19.2658M16.092 7.61194C16.6915 8.17095 17.17 8.84686 17.4982 9.59797C17.8263 10.3491 17.9971 11.1595 18 11.9791C18.0028 12.7988 17.8377 13.6103 17.5148 14.3637C17.1919 15.1171 16.7181 15.7963 16.1225 16.3595M7.4803 15.4069L9.15553 17.48C10.0288 18.5607 10.4655 19.1011 10.848 19.1599C11.1792 19.2108 11.5138 19.0925 11.7394 18.8448C12 18.5586 12 17.8638 12 16.4744V7.52572C12 6.13627 12 5.44155 11.7394 5.15536C11.5138 4.90761 11.1792 4.78929 10.848 4.84021C10.4655 4.89904 10.0288 5.43939 9.15553 6.52009L7.4803 8.59319C7.30388 8.81151 7.21567 8.92067 7.10652 8.99922C7.00982 9.06881 6.90147 9.12056 6.78656 9.15204C6.65687 9.18756 6.51652 9.18756 6.23583 9.18756H4.8125C4.0563 9.18756 3.6782 9.18756 3.37264 9.2885C2.77131 9.48716 2.2996 9.95887 2.10094 10.5602C2 10.8658 2 11.2439 2 12.0001C2 12.7563 2 13.1344 2.10094 13.4399C2.2996 14.0413 2.77131 14.513 3.37264 14.7116C3.6782 14.8126 4.0563 14.8126 4.8125 14.8126H6.23583C6.51652 14.8126 6.65687 14.8126 6.78656 14.8481C6.90147 14.8796 7.00982 14.9313 7.10652 15.0009C7.21567 15.0794 7.30388 15.1886 7.4803 15.4069Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}


export default function EditorFooter(p: Props) {
  return (
    <>
      <footer ref={p.refEl as any} className="local-footer viewer-toolbar shrink-0 z-20" role="toolbar" aria-label="Flipbook controls">
        <div className="toolbar-inner">
          {/* 🔇 Desktop mute toggle ЛІВОРУЧ (показуємо лише якщо передали toggleSound) */}
          {!p.isNarrow && p.toggleSound && (
            <button className={`toolbtn tool-sound ${p.soundMuted ? "muted" : ""}`} onClick={p.toggleSound}
                    aria-pressed={!!p.soundMuted} title={p.soundMuted ? "Unmute sound" : "Mute sound"}
                    aria-label={p.soundMuted ? "Unmute sound" : "Mute sound"}>
              <IconSound muted={!!p.soundMuted} />
            </button>
          )}

          <button className={`toolbtn ${p.currentIndex === 0 ? "disabled" : ""}`} onClick={p.goFirst} disabled={p.currentIndex === 0} title="First page" aria-label="First page">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M20 6l-9 6 9 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <button className={`toolbtn ${!p.canPrev ? "disabled" : ""}`} onClick={p.goPrev} disabled={!p.canPrev} title="Previous" aria-label="Previous page">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <div className="page-jump">
            <input id="pageJump" inputMode="numeric" pattern="[0-9]*" className="jump-inp" value={p.pageJump}
                   onChange={(e) => p.setPageJump(e.target.value.replace(/[^\d]/g, ""))}
                   onKeyDown={(e) => { if (e.key === "Enter") p.submitJump(); }}
                   title="Enter page number" aria-label="Enter page number" />
            <div className="jump-total">/ <span className="jump-total-strong">{p.numPages}</span></div>
            {!p.isNarrow && (
              <button className="toolbtn slim" onClick={p.submitJump} title="Go" aria-label="Go to page">
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
          </div>

          <button className={`toolbtn ${!p.canNext ? "disabled" : ""}`} onClick={p.goNext} disabled={!p.canNext} title="Next" aria-label="Next page">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <button className={`toolbtn ${!p.canNext ? "disabled" : ""}`} onClick={p.goLast} disabled={!p.canNext} title="Last page" aria-label="Last page">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 19V5M4 18l9-6-9-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          <button className={`toolbtn tool-zoom ${p.loupeOn ? "active" : ""}`} onClick={() => p.setLoupeOn((v) => !v)} aria-pressed={p.loupeOn} title={p.loupeOn ? "Disable magnifier" : "Enable magnifier"} aria-label="Toggle magnifier">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" fill="none"/>
              <path d="M20.5 20.5l-4.2-4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
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
