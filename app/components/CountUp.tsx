"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  end: number;
  start?: number;
  duration?: number;      // ms
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  once?: boolean;
  delay?: number;         // ms
  formatter?: (value: number, decimals: number) => string;
};

export default function CountUp({
  end,
  start = 0,
  duration = 1400,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  once = true,
  delay = 0,
  formatter,
}: Props) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const startedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Уникаємо гідратаційного “стрибка”: починаємо зі start
  const [val, setVal] = useState<number>(start);

  const prefersReduced = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const fmt = useMemo(
    () =>
      formatter ??
      ((v: number, d: number) => v.toFixed(d)),
    [formatter]
  );

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    // Якщо reduce motion — показуємо одразу ціль
    if (prefersReduced) {
      setVal(end);
      return;
    }

    const animate = (startTs: number) => (ts: number) => {
      const elapsed = ts - startTs;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (end - start) * eased;
      setVal(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate(startTs));
      }
    };

    const begin = () => {
      if (startedRef.current && once) return;
      startedRef.current = true;

      const kick = () => {
        const startTs = performance.now();
        rafRef.current = requestAnimationFrame(animate(startTs));
      };

      if (delay > 0) {
        timeoutRef.current = window.setTimeout(kick, delay);
      } else {
        kick();
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            begin();
            if (once) io.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );

    io.observe(el);

    return () => {
      io.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    };
    // важливо реагувати і на зміни end/start/duration/delay/once
  }, [end, start, duration, delay, once, prefersReduced]);

  return (
    <span ref={spanRef} className={className} aria-live="polite">
      {prefix}
      {fmt(val, decimals)}
      {suffix}
    </span>
  );
}
