"use client";
import { createPortal } from "react-dom";

export function LoupePortal(props:{
  enabled:boolean;
  state:{ visible:boolean; clientX:number; clientY:number; imgRect:DOMRect|null; contentW:number; contentH:number; offsetX:number; offsetY:number; url:string; };
  size:number; zoom:number;
}) {
  if (typeof document === "undefined") return null;
  const { enabled, state, size, zoom } = props;
  if (!enabled || !state.visible || !state.imgRect) return null;

  const { clientX, clientY, imgRect, contentW, contentH, offsetX, offsetY, url } = state;
  const imgX = Math.max(0, Math.min(contentW, clientX - (imgRect.left + offsetX)));
  const imgY = Math.max(0, Math.min(contentH, clientY - (imgRect.top + offsetY)));
  const innerLeft = -(imgX * zoom - size / 2);
  const innerTop = -(imgY * zoom - size / 2);

  return createPortal(
    <div className="portal-loupe" style={{ left: clientX - size / 2, top: clientY - size / 2, width: size, height: size }}>
      <img
        src={url} alt="" draggable={false}
        style={{ position:"absolute", width: contentW * zoom, height: contentH * zoom, left: innerLeft, top: innerTop, pointerEvents:"none", userSelect:"none", maxWidth:"none", maxHeight:"none" }}
      />
    </div>,
    document.body
  );
}
