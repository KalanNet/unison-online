"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Поріг у px для спрацювання свайпу */
  threshold?: number;
  /** Загальне увімк/вимк свайпу ззовні */
  enabled?: boolean;
  /**
   * Елемент, усередині якого користувач масштабує/скролить контент сторінки.
   * Якщо він ширший/вищий за видиму область (або має scale > 1) — свайп блокуємо.
   */
  panEl?: HTMLElement | null;
  /** Якщо зовнішня логіка вже знає, що сторінка “збільшена” — можна передати явно */
  isZoomed?: boolean;
};

/** Прочитати scale з transform матриці (якщо є) */
function readElementScale(el: HTMLElement | null): number {
  if (!el) return 1;
  const style = getComputedStyle(el);
  const tr = style.transform || style.webkitTransform;
  if (!tr || tr === "none") return 1;
  // matrix(a,b,c,d,tx,ty) — scaleX=a, scaleY=d (для 2D)
  const m = tr.match(/matrix\(([-\d.,\s]+)\)/);
  if (m && m[1]) {
    const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
    if (parts.length >= 4 && Number.isFinite(parts[0]) && Number.isFinite(parts[3])) {
      const sx = Math.abs(parts[0]);
      const sy = Math.abs(parts[3]);
      return Math.max(sx, sy);
    }
  }
  // matrix3d(...) — беремо діагональні елементи
  const m3 = tr.match(/matrix3d\(([-\d.,\s]+)\)/);
  if (m3 && m3[1]) {
    const p = m3[1].split(",").map((s) => parseFloat(s.trim()));
    // scaleX = p[0], scaleY = p[5], scaleZ = p[10]
    if (p.length >= 11) {
      const sx = Math.abs(p[0]), sy = Math.abs(p[5]), sz = Math.abs(p[10]);
      return Math.max(sx, sy, sz);
    }
  }
  return 1;
}

export default function MobileSwipe({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  enabled = true,
  panEl = null,
  isZoomed,
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);

  // ====== Double-tap пауза (щоб не заважати дабл-тап зуму) ======
  const [suspendSwipe, setSuspendSwipe] = React.useState(false);
  const lastTapTsRef = React.useRef(0);
  const lastTapXRef = React.useRef(0);
  const lastTapYRef = React.useRef(0);

  // ====== Вирішення жестикулації ======
  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const dx = React.useRef(0);
  const dragging = React.useRef(false);
  const decided = React.useRef<null | "h" | "v">(null);
  const activeTouchCount = React.useRef(0);

  // ====== Анімації картки (як у твоєму оригіналі) ======
  const setStyle = (x: number, animate = false) => {
    const el = ref.current;
    if (!el) return;
    const rot = Math.max(-12, Math.min(12, x * 0.06));
    const op = Math.max(0.25, 1 - Math.abs(x) / 600);
    el.style.transition = animate ? "transform 280ms, opacity 280ms" : "none";
    el.style.transform = `translateX(${x}px) rotate(${rot}deg)`;
    el.style.opacity = String(op);
  };
  const reset = () => {
    const el = ref.current; if (!el) return;
    setStyle(0, true);
    window.setTimeout(() => {
      el.style.transition = "none";
      el.style.transform = "translateX(0) rotate(0deg)";
      el.style.opacity = "1";
    }, 300);
  };
  const flingOff = (dir: "left" | "right") => {
    const el = ref.current; if (!el) return;
    const w = window.innerWidth || 480;
    const targetX = dir === "left" ? -w * 1.1 : w * 1.1;
    setStyle(targetX, true);
    window.setTimeout(() => {
      reset();
      if (dir === "left") onSwipeLeft?.();
      else onSwipeRight?.();
    }, 260);
  };

  // ====== Обчислення “контент збільшений” ======
  const [contentZoomed, setContentZoomed] = React.useState(false);

  const recomputeZoomed = React.useCallback(() => {
    if (typeof isZoomed === "boolean") { setContentZoomed(isZoomed); return; }
    const el = panEl;
    if (!el) { setContentZoomed(false); return; }

    const scale = readElementScale(el);
    const scrollZoomed =
      el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;

    setContentZoomed(scale > 1.01 || scrollZoomed);
  }, [panEl, isZoomed]);

  React.useEffect(() => { recomputeZoomed(); }, [recomputeZoomed]);

  // Якщо внутрішній контейнер змінює розміри/скрол — трекаємо
  React.useEffect(() => {
    const el = panEl;
    if (!el) return;
    const ro = new ResizeObserver(recomputeZoomed);
    ro.observe(el);
    let int: any = null;
    // просте опитування скролу (дешево), бо scroll events не завжди доходять до нас
    int = window.setInterval(recomputeZoomed, 200);
    return () => {
      ro.disconnect();
      if (int) window.clearInterval(int);
    };
  }, [panEl, recomputeZoomed]);

  // ====== Коли свайп вимкнений — скидаємо трансформації ======
  const swipeBlocked = !enabled || suspendSwipe || contentZoomed || activeTouchCount.current > 1;

  React.useEffect(() => {
    if (swipeBlocked) {
      dragging.current = false;
      decided.current = null;
      dx.current = 0;
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeBlocked]);

  // ====== Хендлери ======
  const onStart = (clientX: number, clientY: number, ts?: number) => {
    // double-tap
    if (typeof ts === "number") {
      const dt = ts - lastTapTsRef.current;
      const dxTap = Math.abs(clientX - lastTapXRef.current);
      const dyTap = Math.abs(clientY - lastTapYRef.current);
      if (dt < 300 && dxTap < 30 && dyTap < 30) {
        setSuspendSwipe(true);
        window.setTimeout(() => setSuspendSwipe(false), 650);
      }
      lastTapTsRef.current = ts;
      lastTapXRef.current = clientX;
      lastTapYRef.current = clientY;
    }

    if (swipeBlocked) return;
    dragging.current = true;
    decided.current = null;
    startX.current = clientX;
    startY.current = clientY;
    dx.current = 0;
  };

  const onMove = (clientX: number, clientY: number, e?: Event) => {
    if (swipeBlocked || !dragging.current) return;
    const ddx = clientX - startX.current;
    const ddy = clientY - startY.current;

    if (!decided.current) {
      if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) {
        decided.current = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
      }
    }

    if (decided.current === "h") {
      // якщо контент може панитись горизонтально — не крадемо жест
      const el = panEl;
      const canPanX = !!el && el.scrollWidth > el.clientWidth + 1;
      if (canPanX) return; // хай паниться, свайп не захоплюємо

      (e as any)?.preventDefault?.(); // блокуємо вертикальний скрол тільки коли вирішили "h"
      dx.current = ddx;
      setStyle(dx.current);
    }
  };

  const onEnd = () => {
    if (swipeBlocked || !dragging.current) return;
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

  // ====== DOM listeners ======
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // touch
    const ts = (e: TouchEvent) => {
      activeTouchCount.current = e.touches.length;
      onStart(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp);
    };
    const tm = (e: TouchEvent) => {
      activeTouchCount.current = e.touches.length;
      onMove(e.touches[0].clientX, e.touches[0].clientY, e);
    };
    const te = () => {
      activeTouchCount.current = 0;
      onEnd();
    };

    // важливо: touchmove НЕ пасивний — щоб preventDefault спрацьовував
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", te);
    el.addEventListener("touchcancel", te);

    // mouse (debug)
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
  }, [swipeBlocked, panEl]);

  // коли свайп заблокований — даємо браузеру/контейнеру повну свободу жестів
  const wrapperStyle: React.CSSProperties = {
    willChange: "transform, opacity",
    touchAction: swipeBlocked ? "auto" : "pan-y",
  };

  return (
    <div ref={ref} className="swipe-card" style={wrapperStyle}>
      {children}
    </div>
  );
}
