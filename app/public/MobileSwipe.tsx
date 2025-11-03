"use client";

import React from "react";

type Props = {
  /** вміст «картки» */
  children: React.ReactNode;
  /** викликається, коли користувач «змахнув» ліворуч (наступна сторінка) */
  onSwipeLeft?: () => void;
  /** викликається, коли користувач «змахнув» праворуч (попередня сторінка) */
  onSwipeRight?: () => void;
  /** пікселі до спрацювання свайпу */
  threshold?: number;
  /** примусово увімк/вимк свайп ззовні */
  enabled?: boolean;
};

/**
 * MobileSwipe (zoom-safe + animated):
 *  - блокує свайп, коли активний браузерний зум (visualViewport.scale > 1)
 *  - під час double-tap тимчасово вимикає свайп (~650 мс), щоб не заважати zoom
 *  - зберігає анімацію картки (translate/rotate/opacity), fling-off/reset
 *  - визначає напрям жесту (горизонтальний/вертикальний) і блокує вертикальний скрол під час горизонтального
 *  - підтримує мишу для зручного дебагу
 */
export default function MobileSwipe({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  enabled = true,
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);

  // ===== Zoom state (visualViewport) =====
  const [vvScale, setVvScale] = React.useState(1);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onChange = () => setVvScale(vv.scale ?? 1);
    onChange();
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    };
  }, []);

  // ===== Double-tap detection (для паузи свайпу) =====
  const [suspendSwipe, setSuspendSwipe] = React.useState(false);
  const lastTapTsRef = React.useRef<number>(0);
  const lastTapXRef = React.useRef<number>(0);
  const lastTapYRef = React.useRef<number>(0);

  // ===== Gesture refs (анімація + вирішення напряму) =====
  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const dx = React.useRef(0);
  const dragging = React.useRef(false);
  const decided = React.useRef<null | "h" | "v">(null); // горизонтально/вертикально

  // Головний перемикач
  const zoomActive = vvScale > 1.01;
  const swipeEnabled = enabled && !zoomActive && !suspendSwipe;

  // ===== Helpers: анімаційні стилі =====
  const setStyle = (x: number, animate = false) => {
    const el = ref.current;
    if (!el) return;
    const rot = Math.max(-12, Math.min(12, x * 0.06)); // невеликий нахил
    const op = Math.max(0.25, 1 - Math.abs(x) / 600);  // трохи тьмяніє
    el.style.transition = animate ? "transform 280ms, opacity 280ms" : "none";
    el.style.transform = `translateX(${x}px) rotate(${rot}deg)`;
    el.style.opacity = String(op);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    setStyle(0, true);
    window.setTimeout(() => {
      el.style.transition = "none";
      el.style.opacity = "1";
      el.style.transform = "translateX(0) rotate(0deg)";
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

  // Якщо посеред жесту з’явився zoom або double-tap — скинемо трансформацію
  React.useEffect(() => {
    if (!swipeEnabled) {
      dragging.current = false;
      decided.current = null;
      dx.current = 0;
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeEnabled]);

  // ===== Core handlers =====
  const onStart = (clientX: number, clientY: number, ts?: number) => {
    // Double-tap detection
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

    if (!swipeEnabled) return;
    dragging.current = true;
    decided.current = null;
    startX.current = clientX;
    startY.current = clientY;
    dx.current = 0;
  };

  const onMove = (clientX: number, clientY: number, e?: Event) => {
    if (!swipeEnabled || !dragging.current) return;
    const ddx = clientX - startX.current;
    const ddy = clientY - startY.current;

    if (!decided.current) {
      if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) {
        decided.current = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
      }
    }

    if (decided.current === "h") {
      // блокуємо вертикальну прокрутку, коли це горизонтальний жест
      (e as any)?.preventDefault?.();
      dx.current = ddx;
      setStyle(dx.current);
    }
  };

  const onEnd = () => {
    if (!swipeEnabled || !dragging.current) return;
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

  // ===== DOM listeners (touch + mouse) =====
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // touch
    const ts = (e: TouchEvent) =>
      onStart(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp);
    const tm = (e: TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY, e);
    const te = () => onEnd();

    // важливо: touchmove має бути НЕ пасивним, щоб sp.preventDefault працював
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
  }, [swipeEnabled]);

  // Коли свайп вимкнено — залишаємо браузеру повну свободу gesture-ів (пінч/дабл-тап).
  // Коли увімкнено — дозволяємо вертикальний пан (для внутрішніх елементів), горизонтальний перехоплюємо ми.
  const wrapperStyle: React.CSSProperties = {
    willChange: "transform, opacity",
    touchAction: swipeEnabled ? "pan-y" : "auto",
  };

  return (
    <div ref={ref} className="swipe-card" style={wrapperStyle}>
      {children}
    </div>
  );
}
