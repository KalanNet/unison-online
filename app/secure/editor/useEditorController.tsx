// app/secure/editor/useEditorController.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
const FlipBook = HTMLFlipBook as unknown as React.ComponentType<any>;

const MOBILE_BP = 600;

type PDFJS = typeof import("pdfjs-dist");
type PDFDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;

export type SearchBox = { x: number; y: number; w: number; h: number };
export type SearchHit = { id: string; page: number; box: SearchBox; snippet: string };
type PageBmp = {
  url: string; w: number; h: number;
  links: Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }>;
};

function genId() {
  try { // @ts-ignore
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}
function sanitizeLink(a: any): string | null {
  let url = (a && (a.unsafeUrl || a.url)) || "";
  if (!url) return null;
  if (/^javascript:/i.test(url)) {
    const m = url.match(/https?:\/\/[^\s'")]+/i) || url.match(/mailto:[^\s'")]+/i) || url.match(/tel:[^\s'")]+/i);
    url = m ? m[0] : "";
  }
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : null;
}
function useIsNarrow(max = 600) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${max}px)`); const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, [max]);
  return narrow;
}

export function useViewerController({ file, title }: { file: string; title?: string }) {
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

  // пошук
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeHit, setActiveHit] = useState<number>(-1);
  const [pageHighlights, setPageHighlights] = useState<Map<number, SearchBox[]>>(() => new Map());

  // fullscreen (десктоп)
  const [isFs, setIsFs] = useState(false);

  // Share hint
  const [shareHint, setShareHint] = useState("");

  /* ---------- pdf.js init ---------- */
  useEffect(() => {
    let mounted = true; let worker: Worker | null = null;
    (async () => {
      if (typeof window === "undefined") return;
      const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      worker = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
      (lib as any).GlobalWorkerOptions.workerPort = worker;
      if (mounted) setPdfjs(lib);
    })();
    return () => { mounted = false; try { worker?.terminate(); } catch {} };
  }, []);

  /* ---------- load file ---------- */
  useEffect(() => {
    if (!pdfjs || !file) return;
    (async () => {
      const res = await fetch(file); if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const task = pdfjs.getDocument({ data: buf });
      const doc = await task.promise;

      cacheRef.current.clear();
      setPdfDoc(doc); setCurrentIndex(0);

      const p1 = await doc.getPage(1);
      const vp1 = p1.getViewport({ scale: 1 });
      setPageW(vp1.width); setPageH(vp1.height);

      setTimeout(() => { void calcFitScale(); warmPagesAround(0); }, 0);
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
    const pad = 16;
    const availW = Math.max(0, rect.width - pad * 2);
    const availH = Math.max(0, rect.height - pad * 2);

    const gap = single ? 0 : 12;
    const neededW = single ? vp.width : vp.width * 2 + gap;

    const sW = availW / neededW;
    const sH = availH / vp.height;
    setFitScale(Math.max(0.1, Math.min(sW, sH)));

    try { bookRef.current?.pageFlip?.().update(); } catch {}
  }

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
  async function renderPageToImage(pageNum: number): Promise<PageBmp> {
    if (!pdfDoc || !pdfjs) throw new Error("No pdf loaded");
    const page = await pdfDoc.getPage(pageNum);

    const css = getPageCssSize({ w: pageW, h: pageH }, fitScale);
    const DPR_CAP = 7, QUALITY = 3;
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    const scale = Math.max(0.1, (css.w / pageW) * dpr * QUALITY);
    const vp = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(vp.width));
    canvas.height = Math.max(1, Math.round(vp.height));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D context unavailable");
await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;


    const anns = await page.getAnnotations({ intent: "display" });
    const links: PageBmp["links"] = [];
    anns.forEach((a: any) => {
      if (a.subtype !== "Link") return;
      const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
      const left = Math.min(x1, x2), top = Math.min(y1, y2);
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      links.push({ x: left / vp.width, y: top / vp.height, w: w / vp.width, h: h / vp.height, href: sanitizeLink(a) || undefined, dest: a.dest });
    });

    return { url: canvas.toDataURL("image/png"), w: vp.width, h: vp.height, links };
  }
  const [, setTick] = useState(0);
  function warmPagesAround(idx0: number) {
    if (!pdfDoc) return;
    const want = new Set<number>();
    const clamp = (n: number) => Math.max(1, Math.min(pdfDoc.numPages, n));
    for (let d = -3; d <= 3; d++) want.add(clamp(idx0 + 1 + d));
    want.forEach(async (p) => {
      if (cacheRef.current.has(p)) return;
      try { const bmp = await renderPageToImage(p); cacheRef.current.set(p, bmp); setTick((t) => t + 1); } catch {}
    });
  }

  /* ---------- search ---------- */
  function normBox(x: number, y: number, w: number, h: number, PW: number, PH: number): SearchBox {
    return { x: Math.max(0, x / PW), y: Math.max(0, y / PH), w: Math.max(0, w / PW), h: Math.max(0, h / PH) };
  }
  async function runSearch(query: string) {
    if (!pdfDoc) return;
    const q = query.trim();
    setSearchQuery(q);
    setActiveHit(-1);
    setHits([]);
    setPageHighlights(new Map());
    if (!q) return;

    setSearching(true);
    const nextHits: SearchHit[] = [];
    const nextMap = new Map<number, SearchBox[]>();

    try {
      const ql = q.toLowerCase();
      for (let p = 1; p <= pdfDoc.numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const text = await page.getTextContent();
        for (const item of text.items as any[]) {
          const str: string = item.str ?? "";
          if (!str) continue;
          if (str.toLowerCase().includes(ql)) {
            const tr = item.transform as number[];
            const x = tr[4];
            const yTop = tr[5] - (item.height ?? 0);
            const w = item.width ?? 0;
            const h = item.height ?? 0;
            const box = normBox(x, yTop, w, h, vp.width, vp.height);
            const hit: SearchHit = { id: genId(), page: p, box, snippet: str.length > 120 ? str.slice(0, 120) + "…" : str };
            nextHits.push(hit);
            if (!nextMap.has(p)) nextMap.set(p, []);
            nextMap.get(p)!.push(box);
          }
        }
      }
    } finally {
      setSearching(false);
    }

    setHits(nextHits);
    setPageHighlights(nextMap);
    if (nextHits.length) { setActiveHit(0); goToPage(nextHits[0].page); }
  }

  /* ---------- navigation ---------- */
  const canPrev = !!pdfDoc && currentIndex > 0;
  const canNext = !!pdfDoc && currentIndex < (pdfDoc?.numPages ?? 1) - 1;
  function goPrev() { if (!bookRef.current || !canPrev) return; bookRef.current.pageFlip().flipPrev(); }
  function goNext() { if (!bookRef.current || !canNext) return; bookRef.current.pageFlip().flipNext(); }
  function goToPage(p: number) {
    if (!bookRef.current || !pdfDoc) return;
    const idx = Math.max(0, Math.min(pdfDoc.numPages - 1, p - 1));
    bookRef.current.pageFlip().flip(idx);
  }
  function goFirst() { goToPage(1); }
  function goLast() { if (pdfDoc) goToPage(pdfDoc.numPages); }
  useEffect(() => { warmPagesAround(currentIndex); }, [currentIndex, pdfDoc]);

  /* ---------- swipe-to-flip (mobile, anywhere) ---------- */
useEffect(() => {
  const el = stageRef.current;
  if (!el || !isNarrow) return;

  let touching = false;
  let startX = 0, startY = 0, lastX = 0, lastY = 0, t0 = 0;

  const THRESH_X = 40;    // мін. горизонтальний зсув (px)
  const MAX_AY   = 30;    // допустима вертикальна похибка (px)
  const MAX_MS   = 600;   // жорсткий ліміт жесту (ms)

  function onStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    // не заважаємо натискам по лінках/контролах
    const target = e.target as HTMLElement;
    if (target && (target.closest('a, button, input, textarea, select') || target.getAttribute('contenteditable') === 'true')) return;
    touching = true;
    const t = e.touches[0];
    startX = lastX = t.clientX;
    startY = lastY = t.clientY;
    t0 = Date.now();
  }

  function onMove(e: TouchEvent) {
    if (!touching || e.touches.length !== 1) return;
    const t = e.touches[0];
    lastX = t.clientX; lastY = t.clientY;

    const dx = lastX - startX;
    const dy = Math.abs(lastY - startY);

    // якщо вже явно горизонтальний жест — блокуємо нативний скролл
    if (Math.abs(dx) > 12 && dy < MAX_AY) {
      e.preventDefault(); // потребує {passive:false}
    }
  }

  function onEnd(e: TouchEvent) {
    if (!touching) return;
    touching = false;

    const dx = lastX - startX;
    const dy = Math.abs(lastY - startY);
    const dt = Date.now() - t0;

    // фільтр вертикальних свайпів/довгих дотиків
    if (dy > MAX_AY || dt > MAX_MS) return;

    if (dx <= -THRESH_X) { goNext(); }
    else if (dx >= THRESH_X) { goPrev(); }
  }

  // capture:true, passive:false щоб мати змогу preventDefault
  el.addEventListener('touchstart', onStart, { capture: true, passive: true });
  el.addEventListener('touchmove',  onMove,  { capture: true, passive: false });
  el.addEventListener('touchend',   onEnd,   { capture: true, passive: true });

  return () => {
    el.removeEventListener('touchstart', onStart as any, true);
    el.removeEventListener('touchmove',  onMove  as any, true);
    el.removeEventListener('touchend',   onEnd   as any, true);
  };
}, [isNarrow, goNext, goPrev, stageRef.current]);


  const [pageJump, setPageJump] = useState<string>("1");
  useEffect(() => {
    const p = currentIndex + 1;
    const leftNow = single ? p : p === 1 ? 1 : (p % 2 === 0 ? p : p - 1);
    setPageJump(String(leftNow));
  }, [currentIndex, single]);
  function submitJump() {
    if (!pdfDoc) return;
    const num = Math.min(pdfDoc.numPages, Math.max(1, parseInt(pageJump || "1", 10) || 1));
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

const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

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


/** Публікація meta.json/featured: надсилає на /api/publish */
async function publishMetaAndBookmarks() {
  const payload = {
    file,  // PDF public URL
    meta: {
      title: meta.title?.trim() || "",
      description: meta.description?.trim() || "",
      slug: (meta.slug || "").trim(),
      featuredUrl: meta.featuredUrl || null,
    },
    bookmarks: bookmarks.map((b) => ({
      id: b.id,
      page: b.page,
      label: b.label,
      color: b.color ?? null,
    })),
  };

  await fetch("/api/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
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

    .book-container { transition: transform 500ms ease-in-out; transform: translateX(0); }
    .book-container.is-cover { transform: translateX(-25%); }

    .portal-loupe{ position: fixed; z-index: 60; border-radius: 999px; overflow: hidden; box-shadow: 0 10px 26px rgba(0,0,0,.24), inset 0 0 0 2px rgba(255,255,255,.9); pointer-events: none; background:#fff; contain: layout paint; will-change: transform; transform: translateZ(0); }

    @media (max-width: 600px){ .tool-zoom{ display:none !important; } }

    /* Mobile header on/off (мікростилі є всередині компонентів теж) */
  `;

return {
  // refs
  stageRef, bookRef, localHeaderRef, toolbarRef, cacheRef,
  // state
  isNarrow, single, pdfDoc, currentIndex, setCurrentIndex,
  fitScale, baseSize, totalPages,
  searchQuery, setSearchQuery, searching, hits, activeHit, setActiveHit, pageHighlights,
  isFs, shareHint,
  // navigation
  canPrev, canNext, goPrev, goNext, goToPage, goFirst, goLast,
  pageJump, setPageJump, submitJump,
  // search
  runSearch,
  // loupe
  loupeOn, setLoupeOn, loupe, handlePageMouseMove, handlePageMouseLeave, LOUPE_SIZE, LOUPE_ZOOM,
  // share/fs
  toggleFullscreen, handleShare,
  // css
  globalCss,
  bookmarks, addBookmark, removeBookmark, goToBookmark,
  meta, setMeta, setFeatured,
  publishMetaAndBookmarks,
  
  title: title || file || "",   // --- ось цей рядок!
  
};

}
