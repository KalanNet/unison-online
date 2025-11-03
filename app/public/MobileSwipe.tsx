"use client";

import React from "react";

type Props = {
  /** викликається, коли користувач «змахнув» ліворуч (наступна сторінка) */
  onSwipeLeft?: () => void;
  /** викликається, коли користувач «змахнув» праворуч (попередня сторінка) */
  onSwipeRight?: () => void;
  /** опціонально вимкнути жест */
  enabled?: boolean;
  /** вміст, що буде «карткою» */
  children: React.ReactNode;
  /** пікселі до спрацювання свайпу */
  threshold?: number;
};

export default function MobileSwipe({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
  children,
  threshold = 80,
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);

  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const dx = React.useRef(0);
  const dragging = React.useRef(false);
  const decided = React.useRef<null | "h" | "v">(null); // горизонтально/вертикально

  const setStyle = (x: number, animate = false) => {
    const el = ref.current;
    if (!el) return;
    const rot = Math.max(-12, Math.min(12, x * 0.06));      // невеликий нахил
    const op = Math.max(0.25, 1 - Math.abs(x) / 600);       // трохи тьмяніє
    el.style.transition = animate ? "transform 280ms, opacity 280ms" : "none";
    el.style.transform = `translateX(${x}px) rotate(${rot}deg)`;
    el.style.opacity = String(op);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    setStyle(0, true);
    // повернути після анімації
    window.setTimeout(() => {
      el.style.transition = "none";
      el.style.opacity = "1";
    }, 300);
  };

  const flingOff = (dir: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    const w = window.innerWidth || 480;
    const targetX = dir === "left" ? -w * 1.1 : w * 1.1;
    setStyle(targetX, true);
    window.setTimeout(() => {
      reset(); // повернути картку для наступного показу
      if (dir === "left") onSwipeLeft?.();
      else onSwipeRight?.();
    }, 260);
  };

  const onStart = (clientX: number, clientY: number) => {
    if (!enabled) return;
    dragging.current = true;
    decided.current = null;
    startX.current = clientX;
    startY.current = clientY;
    dx.current = 0;
  };

  const onMove = (clientX: number, clientY: number, e?: Event) => {
    if (!enabled || !dragging.current) return;
    const ddx = clientX - startX.current;
    const ddy = clientY - startY.current;

    if (!decided.current) {
      if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) {
        decided.current = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
      }
    }

    if (decided.current === "h") {
      // блокуємо вертикальну прокрутку, коли це горизонтальний свайп
      (e as any)?.preventDefault?.();
      dx.current = ddx;
      setStyle(dx.current);
    }
  };

  const onEnd = () => {
    if (!enabled || !dragging.current) return;
    dragging.current = false;

    if (decided.current === "h") {
      if (Math.abs(dx.current) >= threshold) {
        flingOff(dx.current < 0 ? "left" : "right");
      } else {
        reset();
      }
    } else {
      reset();
    }
  };

  // touch
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ts = (e: TouchEvent) => onStart(e.touches[0].clientX, e.touches[0].clientY);
    const tm = (e: TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY, e);
    const te = () => onEnd();

    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", te);
    el.addEventListener("touchcancel", te);

    // pointer/mouse для емулювання на десктопі
    const md = (e: MouseEvent) => onStart(e.clientX, e.clientY);
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY, e);
    const mu = () => onEnd();

    el.addEventListener("mousedown", md);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);

    return () => {
      el.removeEventListener("touchstart", ts);
      el.removeEventListener("touchmove", tm);
      el.removeEventListener("touchend", te);
      el.removeEventListener("touchcancel", te);
      el.removeEventListener("mousedown", md);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
  }, [enabled]);

  return (
    <div ref={ref} className="swipe-card">
      {children}
      <style jsx>{`
        .swipe-card {
          will-change: transform, opacity;
          touch-action: pan-y; /* дозволяємо вертикальний скрол, але ми блокуємо його, коли жест горизонтальний */
        }
      `}</style>
    </div>
  );
}
