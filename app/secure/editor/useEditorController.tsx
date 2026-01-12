// app/secure/editor/useEditorController.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
const FlipBook = HTMLFlipBook as unknown as React.ComponentType<any>;

const MOBILE_BP = 600;

// ——— WebP capability detector (кешований) ———
let __WEBP_OK: boolean | null = null;
function canEncodeWebP(): boolean {
  if (__WEBP_OK !== null) return __WEBP_OK;
  try {
    const t = document.createElement("canvas").toDataURL("image/webp");
    __WEBP_OK = typeof t === "string" && t.startsWith("data:image/webp");
  } catch {
    __WEBP_OK = false;
  }
  return __WEBP_OK;
}

type PDFJS = typeof import("pdfjs-dist");
type PDFDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;

export type SearchBox = { x: number; y: number; w: number; h: number };
export type SearchHit = { id: string; page: number; box: SearchBox; snippet: string };

export type TocItem = {
  id: string;
  label: string;
  page: number;
  isSection?: boolean;
};

// ——— TOC label helpers (зберігаємо пробіли) ———
function normalizeLabel(raw: string): string {
  return String(raw ?? "")
    .replace(/\u00A0/g, " ")  // NBSP -> звичайний пробіл
    .replace(/\s+/g, " ")     // кілька пробілів -> один
    .trim();
}


type PageBmp = {
  url: string;
  w: number;
  h: number;
  links: Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }>;
};


function genId() {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}
function sanitizeLink(a: any): string | null {
  let url = (a && (a.unsafeUrl || a.url)) || "";
  if (!url) return null;
  if (/^javascript:/i.test(url)) {
    const m =
      url.match(/https?:\/\/[^\s'")]+/i) ||
      url.match(/mailto:[^\s'")]+/i) ||
      url.match(/tel:[^\s'")]+/i);
    url = m ? m[0] : "";
  }
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : null;
}
function useIsNarrow(max = 600) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${max}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [max]);
  return narrow;
}

export function useViewerController({
  file,
  title,
  onFlip,
}: {
  file: string;
  title?: string;
  onFlip?: () => void;
}) {

  /* ---------- refs та базові стани ---------- */
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const localHeaderRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const isNarrow = useIsNarrow(600);
  const single = isNarrow;

  const [pdfjs, setPdfjs] = useState<PDFJS | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [fitScale, setFitScale] = useState(1);
  const [pageW, setPageW] = useState<number>(1000);
  const [pageH, setPageH] = useState<number>(1414);

  const cacheRef = useRef<Map<number, PageBmp>>(new Map());

  // app/secure/editor/useEditorController.tsx — objectURL utils
  const urlsRef = useRef<Set<string>>(new Set());
  function registerUrl(u: string) {
    try {
      urlsRef.current.add(u);
    } catch {}
  }
  function revokeAllUrls() {
    try {
      urlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
      urlsRef.current.clear();
    } catch {}
  }

  // словник слів з PDF (для пошуку схожих слів)
  const pdfWordsRef = useRef<Set<string> | null>(null);

  // пошук
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeHit, setActiveHit] = useState<number>(-1);
  type HighlightBox = SearchBox & { hitIndex?: number };

  const [pageHighlights, setPageHighlights] = useState<Map<number, HighlightBox[]>>(
    () => new Map()
  );

  // слово, яке фактично використали для пошуку (якщо застосували підказку)
  const [searchSuggestion, setSearchSuggestion] = useState<string | null>(null);

  // fullscreen (десктоп)
  const [isFs, setIsFs] = useState(false);

  // Share hint
  const [shareHint, setShareHint] = useState("");



  /* ---------- pdf.js init ---------- */
  useEffect(() => {
    let mounted = true;
    let worker: Worker | null = null;
    (async () => {
      if (typeof window === "undefined") return;
      const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      worker = new Worker(
        new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" }
      );
      (lib as any).GlobalWorkerOptions.workerPort = worker;
      if (mounted) setPdfjs(lib);
    })();
    return () => {
      mounted = false;
      try {
        worker?.terminate();
      } catch {}
    };
  }, []);

  /* ---------- load file ---------- */
  useEffect(() => {
    if (!pdfjs || !file) return;
    (async () => {
      // новий файл → зачистити попередні objectURL та кеш
      revokeAllUrls();
      cacheRef.current.clear();
      pdfWordsRef.current = null; // скидаємо словник слів для нового PDF

      const res = await fetch(file);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const task = pdfjs.getDocument({ data: buf });
      const doc = await task.promise;

      setPdfDoc(doc);
      setCurrentIndex(0);

      const p1 = await doc.getPage(1);
      const vp1 = p1.getViewport({ scale: 1 });
      setPageW(vp1.width);
      setPageH(vp1.height);

      requestAnimationFrame(() => {
        void calcFitScale();
        warmPagesAround(0);
      });
    })().catch(console.error);
  }, [pdfjs, file]);



  /* ---------- глобальна висота + fullscreen ---------- */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const cls = "viewer-hide-global-footer";
    document.documentElement.classList.add(cls);


    const setAppH = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--app-h", `${Math.round(h)}px`);
    };
    setAppH();


    const schedule = () => {
      setAppH();
      try { bookRef.current?.pageFlip?.().update(); } catch {}
      void calcFitScale(); setTimeout(() => void calcFitScale(), 80);
    };


    window.addEventListener("resize", schedule, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", schedule as any, { passive: true } as any);
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);


    return () => {
      document.documentElement.classList.remove(cls);
      window.removeEventListener("resize", schedule);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", schedule as any);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);


  /* ---------- fit scale ---------- */
  async function calcFitScale() {
    if (!pdfDoc || !stageRef.current) return;
    const page = await pdfDoc.getPage(1);
    const rotation = page.rotate || 0;
    const vp = page.getViewport({ scale: 1, rotation });


    const rect = stageRef.current.getBoundingClientRect();
    
    // FIX 1: Збільшено pad з 16 до 60, щоб врахувати бокові "рейки" (закладки)
    // CSS має var(--rail) ~48px. 60px — це безпечний запас.
    const pad = 60; 
    
    const availW = Math.max(0, rect.width - pad * 2);
    const availH = Math.max(0, rect.height - pad * 2);


    const gap = single ? 0 : 12;
    const neededW = single ? vp.width : vp.width * 2 + gap;


    const sW = availW / neededW;
    const sH = availH / vp.height;
    
    // Встановлюємо масштаб, але НЕ викликаємо update() тут синхронно
    setFitScale(Math.max(0.1, Math.min(sW, sH)));
  }

  // FIX 2: Окремий ефект для оновлення фліпбука ПІСЛЯ зміни масштабу
  useEffect(() => {
    if (!bookRef.current) return;
    // Невелика затримка (50мс), щоб дати React час оновити ширину/висоту в DOM
    const t = setTimeout(() => {
      try { bookRef.current?.pageFlip?.().update(); } catch {}
    }, 50);
    return () => clearTimeout(t);
  }, [fitScale, single]); // Перераховуємо при зміні масштабу або режиму сторінки


  useEffect(() => {
    if (!pdfDoc || !stageRef.current) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { void calcFitScale(); setTimeout(() => void calcFitScale(), 120); });
    };
    const roStage = new ResizeObserver(schedule); roStage.observe(stageRef.current);
    const roHeader = localHeaderRef.current ? new ResizeObserver(schedule) : null; roHeader?.observe(localHeaderRef.current!);
    const roToolbar = toolbarRef.current ? new ResizeObserver(schedule) : null; roToolbar?.observe(toolbarRef.current!);
    const roBody = new ResizeObserver(schedule); roBody.observe(document.body);
    window.addEventListener("orientationchange", schedule, { passive: true });


    schedule();
    return () => {
      cancelAnimationFrame(raf);
      roStage.disconnect(); roHeader?.disconnect(); roToolbar?.disconnect(); roBody.disconnect();
      window.removeEventListener("orientationchange", schedule);
    };
  }, [pdfDoc, single, isNarrow]);


/* ---------- render page → image ---------- */
function getPageCssSize(base: { w: number; h: number }, fit: number) {
  return { w: Math.max(1, Math.floor(base.w * fit)), h: Math.max(1, Math.floor(base.h * fit)) };
}

async function canvasToSrc(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<string> {
  if ('toBlob' in canvas) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
    if (blob) {
      const url = URL.createObjectURL(blob);
      registerUrl(url);
      return url;
    }
  }
  // фолбек
  return canvas.toDataURL(mime, quality);
}

async function renderPageToImage(pageNum: number): Promise<PageBmp> {
  if (!pdfDoc || !pdfjs) throw new Error("No pdf loaded");

  const page = await pdfDoc.getPage(pageNum);
  const css = getPageCssSize({ w: pageW, h: pageH }, fitScale);

  // Ліміти якості/розміру — ключ до плавності
const QUALITY = 1.5;
const DPR_CAP = 5.0;
const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
const targetW = Math.min(6000, Math.round(css.w * dpr * QUALITY));
const scale = Math.max(1.0, targetW / pageW);

  const vp = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width  = Math.max(1, Math.round(vp.width));
  canvas.height = Math.max(1, Math.round(vp.height));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D context unavailable");
ctx.imageSmoothingEnabled = false;
ctx.imageSmoothingQuality = "low"; // або взагалі не задавати

  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;

  // лінки
  const anns = await page.getAnnotations({ intent: "display" });
  const links: PageBmp["links"] = [];
  anns.forEach((a: any) => {
    if (a.subtype !== "Link") return;
    const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
    const left = Math.min(x1, x2), top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    links.push({
      x: left / vp.width, y: top / vp.height, w: w / vp.width, h: h / vp.height,
      href: sanitizeLink(a) || undefined, dest: a.dest
    });
  });

  const mime = canEncodeWebP() ? "image/webp" : "image/png";
  const quality = mime === "image/webp" ? 1.0 : 1.0;

  const url = await canvasToSrc(canvas, mime, quality);
  return { url, w: vp.width, h: vp.height, links };
}









/* ---------- прогрів та черга рендерів ---------- */
const [, setTick] = useState(0);

/* render queue with limited concurrency */
const MAX_CONCURRENCY = 2;
const inflightRef = useRef<Set<number>>(new Set());
const queueRef = useRef<number[]>([]);

function enqueueRender(p: number) {
  if (!pdfDoc) return;
  if (cacheRef.current.has(p)) return;
  if (queueRef.current.includes(p)) return;
  queueRef.current.push(p);
  void pumpQueue();
}

async function pumpQueue() {
  if (!pdfDoc) return;
  while (inflightRef.current.size < MAX_CONCURRENCY && queueRef.current.length > 0) {
    const p = queueRef.current.shift()!;
    if (cacheRef.current.has(p)) continue;
    inflightRef.current.add(p);
    try {
      const bmp = await renderPageToImage(p);
      cacheRef.current.set(p, bmp);
      setTick((t) => t + 1); // тригерим перерендер, щоби підхопити нові сторінки
    } catch {
      // ignore single-page errors
    } finally {
      inflightRef.current.delete(p);
    }
  }
}

function warmPagesAround(idx0: number) {
  if (!pdfDoc) return;
  const clamp = (n: number) => Math.max(1, Math.min(pdfDoc.numPages, n));
  const center = idx0 + 1;

  // Пріоритет: більше вперед (до 5), трохи назад (до 3)
  const order: number[] = [];
  for (let d = 0; d <= 5; d++) {
    if (d !== 0) order.push(clamp(center + d)); // вперед
    if (d <= 3)   order.push(clamp(center - d)); // назад
  }

  order.forEach((p) => enqueueRender(p));
  void pumpQueue();
}



  /* ---------- search ---------- */
  function normBox(
    x: number,
    y: number,
    w: number,
    h: number,
    PW: number,
    PH: number
  ): SearchBox {
    return {
      x: Math.max(0, x / PW),
      y: Math.max(0, y / PH),
      w: Math.max(0, w / PW),
      h: Math.max(0, h / PH),
    };
  }

  // разове будування словника слів із PDF (по всіх сторінках)
  async function buildPdfDictionary() {
    if (!pdfDoc) return;
    if (pdfWordsRef.current) return; // уже побудовано

    const dict = new Set<string>();

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const text = await page.getTextContent();
      for (const item of text.items as any[]) {
        const str: string = item.str ?? "";
        if (!str) continue;

        // простий спліт на слова + очистка від сміття
        const parts = str.split(/[\s,.;:!?()"'«»[\]{}]+/);
        for (const rawWord of parts) {
          const cleaned = rawWord
            .toLowerCase()
            .replace(/[^a-zа-яёіїє0-9]/gi, "");
          if (cleaned.length >= 3) {
            dict.add(cleaned);
          }
        }
      }
    }

    pdfWordsRef.current = dict;
  }

  // відстань Левенштейна між двома рядками
  function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      new Array(n + 1).fill(0)
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      const ai = a[i - 1];
      for (let j = 1; j <= n; j++) {
        const bj = b[j - 1];
        const cost = ai === bj ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // видалення
          dp[i][j - 1] + 1, // вставка
          dp[i - 1][j - 1] + cost // заміна
        );
      }
    }

    return dp[m][n];
  }

  // пошук найближчого слова в словнику PDF
  function suggestFromPdfDict(input: string, maxDistance = 2): string | null {
    const dict = pdfWordsRef.current;
    if (!dict) return null;

    const q = input.toLowerCase();
    let best: string | null = null;
    let bestDist = Infinity;

    for (const word of dict) {
      const d = levenshtein(q, word);
      if (d < bestDist) {
        bestDist = d;
        best = word;
      }
    }

    if (!best || bestDist > maxDistance) return null;
    return best;
  }

  // допоміжний пошук по конкретному терміну (точний includes)
  async function runExactSearch(
    term: string
  ): Promise<{ hits: SearchHit[]; map: Map<number, HighlightBox[]> }> {
    if (!pdfDoc) return { hits: [], map: new Map() };

    const ql = term.toLowerCase();
    const nextHits: SearchHit[] = [];
    const nextMap = new Map<number, HighlightBox[]>();

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const text = await page.getTextContent();
      
      for (const item of text.items as any[]) {
        const str: string = item.str ?? "";
        if (!str) continue;
        
        if (str.toLowerCase().includes(ql)) {
          const tr = item.transform as number[];
          const x = tr[4]; // ліва межа
          const yBaseline = tr[5]; // baseline (низ рядка в pdf.js)
          const w = item.width ?? 0;
          const h = item.height ?? 0;

          const hitIndex = nextHits.length;

          // --- FIX FOR CANVA PDFS (Aggressive V3) ---
          // Проблема: малі шрифти дають малий зсув у пікселях при % розрахунку.
          // Рішення: дуже сильний зсув вниз (65% від висоти) і зменшення висоти самого боксу.
          
          // 1. Зсуваємо вниз на 65% висоти літери. 
          // Якщо шрифт 12px, це буде ~8px вниз (помітно).
          const offsetY = h * 0.80; 
          
          // 2. Висота хайлайту = 75% від оригіналу, щоб не наїжджати на рядок знизу
          const adjustedH = h * 1.30;

          // top у пікселях від ВЕРХУ сторінки viewport:
          // vp.height - (yBaseline + h) = це математичний ВЕРХ тексту.
          // Додаємо offsetY, щоб "притиснути" хайлайт вниз.
          const yTopCssPx = vp.height - (yBaseline + h) + offsetY;

          // нормалізований бокс для нашого оверлею
          const box = normBox(x, yTopCssPx, w, adjustedH, vp.width, vp.height);

          const hit: SearchHit = {
            id: genId(),
            page: p,
            box,
            snippet: str.length > 120 ? str.slice(0, 120) + "…" : str,
          };
          nextHits.push(hit);

          if (!nextMap.has(p)) nextMap.set(p, []);
          nextMap.get(p)!.push({ ...box, hitIndex });
        }
      }
    }

    return { hits: nextHits, map: nextMap };
  }

  async function runSearch(query: string) {
    if (!pdfDoc) return;
    const q = query.trim();
    setSearchQuery(q);
    setActiveHit(-1);
    setHits([]);
    setPageHighlights(new Map());
    setSearchSuggestion(null);
    if (!q) return;

    setSearching(true);

    try {
      // будуємо словник слів PDF, якщо ще не готовий
      await buildPdfDictionary();

      // 1) пробуємо знайти за точним введеним словом
      let effectiveTerm = q;
      let { hits: nextHits, map: nextMap } = await runExactSearch(effectiveTerm);

      // 2) якщо нічого не знайшли — пробуємо схоже слово
      if (!nextHits.length) {
        const suggestion = suggestFromPdfDict(q);
        if (suggestion && suggestion !== q.toLowerCase()) {
          const alt = await runExactSearch(suggestion);
          if (alt.hits.length) {
            nextHits = alt.hits;
            nextMap = alt.map;
            effectiveTerm = suggestion;
            setSearchSuggestion(suggestion); // фактично використали це слово
          }
        }
      }

      setHits(nextHits);
      setPageHighlights(nextMap);
      if (nextHits.length) {
        setActiveHit(0);
        goToPage(nextHits[0].page);
      }
    } finally {
      setSearching(false);
    }
  }



/* ---------- navigation ---------- */

// чи можна гортати назад/вперед
const canPrev = !!pdfDoc && currentIndex > 0;
const canNext = !!pdfDoc && currentIndex < (pdfDoc?.numPages ?? 1) - 1;

/**
 * Абсолютний перехід на вказаний індекс FlipBook (0-based).
 * Використовується тільки для "стрибків": перша/остання, пошук, ручний ввід, закладки.
 */
function gotoIndexAbs(target: number) {
  if (!pdfDoc || !bookRef.current) return;

  const last = pdfDoc.numPages - 1;
  const idx = Math.max(0, Math.min(last, target));

  // прогріваємо кеш під цільовий розворот
  warmPagesAround(idx);

  try {
    const api = (bookRef.current as any).pageFlip?.();
    if (!api) return;
    if (typeof api.turnToPage === "function") {
      api.turnToPage(idx);     // jump на потрібний розворот
    } else if (typeof api.flip === "function") {
      api.flip(idx);           // fallback
    }
  } catch {
    // не ламаємо застосунок, якщо FlipBook щось кинув
  }
}

/** Один крок назад – саме "фліп", а не jump */
function goPrev() {
  if (!canPrev || !bookRef.current) return;
  // прогріваємо сторінку, куди підемо
  warmPagesAround(currentIndex - 1);
  try {
    (bookRef.current as any).pageFlip?.().flipPrev();
  } catch {}
}

/** Один крок вперед – "фліп", а не jump */
function goNext() {
  if (!canNext || !bookRef.current) return;
  warmPagesAround(currentIndex + 1);
  try {
    (bookRef.current as any).pageFlip?.().flipNext();
  } catch {}
}

/** Перехід на PDF-сторінку p (1-based) для пошуку / закладок / ручного вводу */
function goToPage(p: number) {
  if (!pdfDoc) return;
  const page = Math.max(1, Math.min(pdfDoc.numPages, p || 1));
  gotoIndexAbs(page - 1); // 0-based індекс FlipBook
}

/** На першу сторінку */
function goFirst() {
  gotoIndexAbs(0);
}

/** На останню сторінку */
function goLast() {
  if (!pdfDoc) return;
  gotoIndexAbs(pdfDoc.numPages - 1);
}

/**
 * Коли currentIndex змінюється (через onFlip з самого FlipBook),
 * додатково прогріваємо сусідні сторінки.
 */
useEffect(() => {
  warmPagesAround(currentIndex);
}, [currentIndex, pdfDoc]);

/* ---------- swipe-to-flip (mobile, anywhere) ---------- */
useEffect(() => {
  const el = stageRef.current;
  if (!el || !isNarrow) return;

  let touching = false;
  let startX = 0,
    startY = 0,
    lastX = 0,
    lastY = 0,
    t0 = 0;

  const THRESH_X = 40; // мін. горизонтальний зсув (px)
  const MAX_AY = 30;   // допустима вертикальна похибка (px)
  const MAX_MS = 600;  // ліміт тривалості жесту (ms)

  function onStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement;
    // не заважаємо клікам по контролах
    if (
      target &&
      (target.closest("a, button, input, textarea, select") ||
        target.getAttribute("contenteditable") === "true")
    ) {
      return;
    }
    touching = true;
    const t = e.touches[0];
    startX = lastX = t.clientX;
    startY = lastY = t.clientY;
    t0 = Date.now();
  }

  function onMove(e: TouchEvent) {
    if (!touching || e.touches.length !== 1) return;
    const t = e.touches[0];
    lastX = t.clientX;
    lastY = t.clientY;

    const dx = lastX - startX;
    const dy = Math.abs(lastY - startY);

    // явний горизонтальний жест → блокуємо нативний скрол
    if (Math.abs(dx) > 12 && dy < MAX_AY) {
      e.preventDefault();
    }
  }

  function onEnd() {
    if (!touching) return;
    touching = false;

    const dx = lastX - startX;
    const dy = Math.abs(lastY - startY);
    const dt = Date.now() - t0;

    if (dy > MAX_AY || dt > MAX_MS) return;

    if (dx <= -THRESH_X) {
      goNext();
    } else if (dx >= THRESH_X) {
      goPrev();
    }
  }

  el.addEventListener("touchstart", onStart, { capture: true, passive: true });
  el.addEventListener("touchmove", onMove, { capture: true, passive: false });
  el.addEventListener("touchend", onEnd, { capture: true, passive: true });

  return () => {
    el.removeEventListener("touchstart", onStart as any, true);
    el.removeEventListener("touchmove", onMove as any, true);
    el.removeEventListener("touchend", onEnd as any, true);
  };
}, [isNarrow, goNext, goPrev, stageRef]);

/* ---------- pageJump (інпут у футері) ---------- */
const [pageJump, setPageJump] = useState<string>("1");

useEffect(() => {
  const p = currentIndex + 1; // 1-based
  // у спред-режимі показуємо саме ЛІВУ сторінку поточного розвороту
  const leftNow = single ? p : p === 1 ? 1 : p % 2 === 0 ? p : p - 1;
  setPageJump(String(leftNow));
}, [currentIndex, single]);

function submitJump() {
  if (!pdfDoc) return;
  const raw = parseInt(pageJump || "1", 10);
  const num = Math.min(pdfDoc.numPages, Math.max(1, raw || 1));
  goToPage(num);
}



  /* ---------- loupe (desktop only) ---------- */
  const [loupeOn, setLoupeOn] = useState(false);
  type LoupeState = {
    visible: boolean; page: number; clientX: number; clientY: number; imgRect: DOMRect | null;
    contentW: number; contentH: number; offsetX: number; offsetY: number; url: string;
  };
  const [loupe, setLoupe] = useState<LoupeState>({
    visible: false, page: 0, clientX: 0, clientY: 0, imgRect: null, contentW: 0, contentH: 0, offsetX: 0, offsetY: 0, url: "",
  });
  const LOUPE_SIZE = 340;
  const LOUPE_ZOOM = 1.6;


  function handlePageMouseMove(e: React.MouseEvent<HTMLDivElement>, pageNum: number) {
    if (!loupeOn || isNarrow) return;
    const container = e.currentTarget;
    const imgEl = container.querySelector<HTMLImageElement>("img[data-page-img='true']");
    if (!imgEl) return;
    const imgRect = imgEl.getBoundingClientRect();
    const bmp = cacheRef.current.get(pageNum);
    if (!bmp) return;


    const scale = Math.min(imgRect.width / bmp.w, imgRect.height / bmp.h);
    const contentW = bmp.w * scale;
    const contentH = bmp.h * scale;
    const offsetX = (imgRect.width - contentW) / 2;
    const offsetY = (imgRect.height - contentH) / 2;


    const { clientX, clientY } = e;
    const inBmp =
      clientX >= imgRect.left + offsetX &&
      clientX <= imgRect.left + offsetX + contentW &&
      clientY >= imgRect.top + offsetY &&
      clientY <= imgRect.top + offsetY + contentH;


    if (!inBmp) {
      if (loupe.visible) setLoupe((s) => ({ ...s, visible: false }));
      return;
    }


    setLoupe({
      visible: true,
      page: pageNum,
      clientX,
      clientY,
      imgRect,
      contentW,
      contentH,
      offsetX,
      offsetY,
      url: bmp.url,
    });
  }
  function handlePageMouseLeave() { if (!loupeOn) return; setLoupe((s) => ({ ...s, visible: false })); }


  /* ---------- fullscreen (desktop) ---------- */
  async function toggleFullscreen() {
    if (isNarrow) return;
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }


  /* ---------- share ---------- */
  async function handleShare() {
    try {
      const shareData = { title: title || "Unison Catalog", text: "View this directory", url: window.location.href };
      // @ts-ignore
      if (navigator.share) { await navigator.share(shareData); }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(window.location.href); setShareHint("Link copied"); setTimeout(()=>setShareHint(""), 1500); }
    } catch {}
  }


/* ---------- bookmarks & meta ---------- */
type Bookmark = { id: string; page: number; label: string; color?: string | null };

type AdSlot = {
  id: string;
  imageUrl: string;
  href?: string | null;
  label?: string | null;
};

const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

const [ads, setAds] = useState<AdSlot[]>([]);

const [meta, setMetaState] = useState<{
  title: string;
  description: string;
  slug?: string;                 // ← додано
  featuredUrl?: string | null;
}>({
  title: (title || "").trim(),
  description: "",
  slug: "",                      // ← додано
  featuredUrl: null,
});


// helpers
function setMeta(next: Partial<typeof meta>) {
  setMetaState((m) => ({ ...m, ...next }));
}
function setFeatured(url?: string | null) {
  setMetaState((m) => ({ ...m, featuredUrl: url ?? null }));
}

function addAdSlot(input: { imageUrl: string; href?: string | null; label?: string | null }) {
  const id = genId();
  setAds(list => [...list, { id, ...input }]);
}

function updateAdSlot(id: string, patch: Partial<Omit<AdSlot, "id">>) {
  setAds(list => list.map(a => (a.id === id ? { ...a, ...patch } : a)));
}

function removeAdSlot(id: string) {
  setAds(list => list.filter(a => a.id !== id));
}



function addBookmark(
  arg?: number | { page?: number; label?: string; color?: string | null },
  labelMaybe?: string
) {
  const fromObj = typeof arg === "object" && arg !== null ? arg : undefined;
  const pageRaw =
    typeof arg === "number" ? arg :
    fromObj?.page ?? (currentIndex + 1);


  const safePage = pdfDoc
    ? Math.max(1, Math.min(pdfDoc.numPages, Number(pageRaw) || 1))
    : Number(pageRaw) || 1;


  const label =
    (typeof arg === "number" ? labelMaybe : fromObj?.label) ||
    `Page ${safePage}`;


  const color =
    (typeof arg === "object" ? arg?.color : undefined) ?? null;


  setBookmarks((list) => [
    ...list,
    { id: genId(), page: safePage, label: String(label).trim(), color },
  ]);
}


function updateBookmark(id: string, patch: Partial<Bookmark>) {
  setBookmarks((list) =>
    list.map((b) => {
      if (b.id !== id) return b;
      const next: Bookmark = { ...b, ...patch };
      if (patch.page != null && pdfDoc) {
        next.page = Math.max(1, Math.min(pdfDoc.numPages, Number(patch.page) || b.page));
      }
      return next;
    })
  );
}


function removeBookmark(id: string) {
  setBookmarks((list) => list.filter((b) => b.id !== id));
}


function goToBookmark(id: string) {
  const b = bookmarks.find((x) => x.id === id);
  if (b) goToPage(b.page);
}



/* ---------- bookmarks & meta ---------- */
// …(існуючий код цієї секції вище не чіпаємо)

/* ---------- CONTENT (TOC) ---------- */
const [toc, setToc] = useState<TocItem[]>([]);

function sanitizeToc(list: unknown, maxPage = pdfDoc?.numPages ?? 1): TocItem[] {
  if (!Array.isArray(list)) return [];
  const out: TocItem[] = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const any = it as any;
    const id = String(any.id ?? genId()).trim();
    const label = normalizeLabel(any.label ?? ""); // ← зберігаємо пробіли
    const pageRaw = Number(any.page);
    const page = Number.isFinite(pageRaw)
      ? Math.max(1, Math.min(maxPage, Math.trunc(pageRaw)))
      : 1;
    const isSection = !!any.isSection;
    if (id && label) out.push({ id, label, page, isSection });
  }
  return out.sort((a, b) => (a.page - b.page) || a.label.localeCompare(b.label));
}


function addTocItem(init?: { page?: number; label?: string; isSection?: boolean }) {
  const p = init?.page ?? (currentIndex + 1);
  const safe = pdfDoc
    ? Math.max(1, Math.min(pdfDoc.numPages, Number(p) || 1))
    : Math.max(1, Number(p) || 1);
  const label = normalizeLabel(init?.label ?? `Page ${safe}`); // ← з пробілами
  setToc(list =>
    [...list, { id: genId(), label, page: safe, isSection: !!init?.isSection }]
      .sort((a, b) => a.page - b.page)
  );
}


function updateTocItem(id: string, patch: Partial<TocItem>) {
  setToc(list => {
    const max = pdfDoc?.numPages ?? 1;
    return list
      .map(it => {
        if (it.id !== id) return it;
        const next: TocItem = { ...it, ...patch };

        if (patch.page != null) {
          const v = Math.trunc(Number(patch.page));
          next.page = Math.max(1, Math.min(max, Number.isFinite(v) ? v : it.page));
        }

        // ВАЖЛИВО: не чіпаємо next.label — залишаємо як набирає користувач (з проміжними пробілами в кінці)
        // Будь-яку “гігієну” робимо тільки при збереженні (saveToc -> sanitizeToc).

        next.isSection = !!next.isSection;
        return next;
      })
      .sort((a, b) => a.page - b.page);
  });
}



function removeTocItem(id: string) {
  setToc(list => list.filter(it => it.id !== id));
}

async function loadTocBySlug(slug?: string) {
  if (!slug) { setToc([]); return; }
  try {
    const r = await fetch(`/api/directory/${encodeURIComponent(slug)}/content`, { cache: "no-store" });
    if (!r.ok) { setToc([]); return; }
    const j = await r.json().catch(() => []);
    setToc(sanitizeToc(j));
  } catch {
    setToc([]);
  }
}

async function saveToc(): Promise<{ ok: boolean; saved: number }> {
  const slug = (meta?.slug || "").trim();
  if (!slug) throw new Error("Publish meta first to get a slug.");
  const items = sanitizeToc(toc);
  const r = await fetch(`/api/directory/${encodeURIComponent(slug)}/content`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Save failed");
  return { ok: true, saved: items.length };
}

/* автозавантаження TOC при появі slug або зміні pdfDoc */
useEffect(() => { void loadTocBySlug(meta?.slug); }, [meta?.slug, pdfDoc]);

/* ---------- publish: meta + bookmarks ---------- */
async function publishMetaAndBookmarks(): Promise<{
  slug?: string;
  urlPath?: string;
  publicUrl?: string;
  metaJsonUrl?: string;
}> {
  // готуємо тіло запиту — як і раніше, але тепер чекаємо відповідь
  const payload = {
    file,
    meta: {
      title: meta.title || title || "",
      description: meta.description || "",
      featuredUrl: meta.featuredUrl || null,
      slug: meta.slug || (title || "")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-"),
    },
    bookmarks: bookmarks.map((b) => ({
      id: b.id,
      page: b.page,
      label: b.label,
      color: b.color ?? null,
    })),
    ads: ads.map(a => ({
      id: a.id,
      imageUrl: a.imageUrl,
      href: a.href ?? null,
      label: a.label ?? null,
    })),
  };



  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });


  const out = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(out?.error || "Publish failed");


  // намагаємось дістати slug/url із відповіді API
  const slugFromApi: string | undefined = out?.stored?.slug || out?.slug || payload.meta.slug;
  const urlPath: string | undefined =
    out?.urlPath || (slugFromApi ? `/unison-directory/${slugFromApi}` : undefined);


  const publicUrl =
    typeof window !== "undefined" && urlPath
      ? new URL(urlPath, window.location.origin).href
      : undefined;


  // невеликий "хінт", як і раніше
  setShareHint("Published");
  setTimeout(() => setShareHint(""), 1800);


  return { slug: slugFromApi, urlPath, publicUrl, metaJsonUrl: out?.metaJsonUrl };
}




  /* ---------- derived ---------- */
  const totalPages = pdfDoc?.numPages ?? 0;
  const baseSize = useMemo(() => ({ w: pageW, h: pageH }), [pageW, pageH]);


  /* ---------- глобальні стилі (оригінал) ---------- */
  const globalCss = `
    :root{ --app-h: 100dvh; }
    .viewer-root{ height: var(--app-h); background:#21353a; }
    .viewer-hide-global-footer body > footer, .viewer-hide-global-footer .site-footer { display:none !important; }
    .local-header{ border-bottom:1px solid #e9ede3; background:#fafbf8; padding:8px 0; }
    .lh-title{ font-weight:900; color:#2d3018; font-size:16px; letter-spacing:.2px; }
    .lh-search{ display:flex; align-items:center; gap:8px; margin-left:12px; }
    .lh-inp{ width:16rem; background:#fff; border:1px solid #e7ebdf; border-radius:.7rem; padding:.45rem .65rem; color:#2d3018; }
    .lh-btn{ background:#fff; color:#2d3018; border:1px solid #e7ebdf; padding:.45rem .7rem; border-radius:.7rem; font-weight:700; box-shadow:0 4px 12px rgba(0,0,0,.06); }
    .lh-actions{ display:flex; align-items:center; gap:8px; }
    .lh-iconbtn{ background:#fff; border:1px solid #e7ebdf; border-radius:.65rem; padding:.42rem .6rem; line-height:0; display:inline-grid; place-items:center; color:#2d3018; box-shadow:0 4px 12px rgba(0,0,0,.06); }
    .lh-hint{ font-size:12px; color:#2d3018; opacity:.8; margin-left:4px; }


    .viewer-toolbar{ background:#ffffffef; backdrop-filter: blur(6px); border-top:1px solid #ecefe7; }
    .toolbar-inner{ max-width:980px; margin:0 auto; display:flex; gap:.5rem; align-items:center; justify-content:center; padding:8px 12px; overflow-x:auto; }
    .toolbtn{ height:36px; min-width:36px; padding:0 .5rem; display:inline-grid; place-items:center; border:1px solid #e6eadf; background:#fff; color:#2d3018; border-radius:.65rem; box-shadow:0 4px 12px rgba(0,0,0,.06); }
    .toolbtn.slim{ min-width:32px; height:32px; }
    .toolbtn.disabled{ opacity:.45; cursor:not-allowed; }
    .toolbtn.active{ outline:2px solid #8ea05a33; }





    .page-jump{ display:flex; align-items:center; gap:.4rem; background:#fff; border:1px solid #e7ebdf; border-radius:.8rem; padding:.2rem .35rem; }
    .jump-inp{ width:72px; text-align:center; font-weight:800; border:1px solid #e7ebdf; border-radius:.5rem; padding:.3rem .35rem; color:#2d3018; height:32px; }
    .jump-total{ color:#5c6750; }


    .panel-title{ color:#e9f0e4; font-weight:800; margin-bottom:.5rem; }
    .viewer-panel{ background:#fff; box-shadow: inset 0 1px 0 #eef1e8; }



    .portal-loupe{ position: fixed; z-index: 60; border-radius: 999px; overflow: hidden; box-shadow: 0 10px 26px rgba(0,0,0,.24), inset 0 0 0 2px rgba(255,255,255,.9); pointer-events: none; background:#fff; contain: layout paint; will-change: transform; transform: translateZ(0); }


    @media (max-width: 600px){ .tool-zoom{ display:none !important; } }


    /* Mobile header on/off (мікростилі є всередині компонентів теж) */
  `;


  return {
    // refs
    stageRef,
    bookRef,
    localHeaderRef,
    toolbarRef,
    cacheRef,
    // state
    isNarrow,
    single,
    pdfDoc,
    currentIndex,
    setCurrentIndex,
    fitScale,
    baseSize,
    totalPages,
    searchQuery,
    setSearchQuery,
    searching,
    hits,
    activeHit,
    setActiveHit,
    pageHighlights,
    searchSuggestion, // ← НОВЕ поле з фактично використаним словом
    isFs,
    shareHint,
    // navigation
    canPrev,
    canNext,
    goPrev,
    goNext,
    goToPage,
    goFirst,
    goLast,
    pageJump,
    setPageJump,
    submitJump,
    // search
    runSearch,
    // loupe
    loupeOn,
    setLoupeOn,
    loupe,
    handlePageMouseMove,
    handlePageMouseLeave,
    LOUPE_SIZE,
    LOUPE_ZOOM,
    // share/fs
    toggleFullscreen,
    handleShare,
    // css
    globalCss,
    bookmarks, setBookmarks, updateBookmark, addBookmark, removeBookmark, goToBookmark,
  meta, setMeta, setFeatured,
    ads, setAds, addAdSlot, updateAdSlot, removeAdSlot,

  // TOC
  toc, setToc, addTocItem, updateTocItem, removeTocItem, loadTocBySlug, saveToc,

  publishMetaAndBookmarks,

  title: title || file || "",

  };
}