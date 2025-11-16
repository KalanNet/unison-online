// app/components/Viewer.tsx
"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useViewerController } from "app/secure/editor/useEditorController";
import EditorHeader from "app/secure/editor/EditorHeader";
import ViewerFooter from "app/secure/editor/EditorFooter";

type InitMeta = { title: string; description: string; slug: string; featuredUrl: string | null };
type InitBookmark = { id: string; page: number; label: string; color?: string | null };


/* --- SEO limits (golden standards) --- */
const SEO = {
  TITLE_MAX: 60,   // title ~50–60 chars
  DESC_MAX: 155,   // meta description ~155–160 chars
  SLUG_MAX: 60,    // короткі й чисті урли
  LABEL_MAX: 10,   // вимога користувача
};
const SLUG_RE = /^[a-z0-9-]+$/;

/* просте сповіщення */
const notify = (msg: string) => { if (typeof window !== "undefined") alert(msg); };

/* підготовка featured-картинки: ≤200KB, max width 1080, збереження пропорцій */
async function prepareFeaturedUnder200KB(file: File): Promise<File> {
  const MAX_UPLOAD = 2 * 1024 * 1024; // 2MB hard limit
  if (file.size > MAX_UPLOAD) throw new Error("Image must be ≤ 2MB.");

  // якщо вже webp ≤200KB і ширина ≤1080 — нічого не робимо
  if (file.type === "image/webp") {
    const bmp0 = await createImageBitmap(file);
    if (bmp0.width <= 1080 && file.size <= 200 * 1024) return file;
  }

  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / bmp.width);
  const targetW = Math.max(1, Math.round(bmp.width * scale));
  const targetH = Math.max(1, Math.round(bmp.height * scale));

  const c = document.createElement("canvas");
  c.width = targetW; c.height = targetH;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, targetW, targetH);

  const qualities = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4];

  async function tryQualities(): Promise<Blob | null> {
    let cand: Blob | null = null;
    for (const q of qualities) {
      const b = await new Promise<Blob | null>(r => c.toBlob(r, "image/webp", q));
      if (!b) continue;
      cand = b;
      if (b.size <= 200 * 1024) return b;
    }
    return cand; // може бути >200KB — далі спробуємо даунскейл
  }

  let blob = await tryQualities();
  let w = targetW, h = targetH;

  while (blob && blob.size > 200 * 1024 && w > 360 && h > 360) {
    w = Math.round(w * 0.9); h = Math.round(h * 0.9);
    c.width = w; c.height = h;
    ctx.drawImage(bmp, 0, 0, w, h);
    blob = await tryQualities();
  }

  if (!blob) throw new Error("Failed to convert to WebP.");
  return new File([blob], file.name.replace(/\.\w+$/i, ".webp"), { type: "image/webp" });
}


const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "");


/* ---------- slug helpers (Unicode-safe) ---------- */


function _normalizeDashesSpaces(s: string) {
  const dashAll = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;           // усі юнікод-дефіси
  const spacesAll = /[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g; // усі типи пробілів
  return s.replace(dashAll, "-").replace(spacesAll, "-");
}

function _asciiFold(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function _cyrillicToLatin(s: string) {
  const map: Record<string, string> = {
    а:"a", б:"b", в:"v", г:"h", ґ:"g", д:"d", е:"e", є:"ie", ж:"zh", з:"z", и:"y", і:"i", ї:"i", й:"i",
    к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"kh", ц:"ts", ч:"ch",
    ш:"sh", щ:"shch", ь:"", ю:"iu", я:"ia", ъ:"", ы:"y", э:"e",
  };
  return s.replace(/[а-яёіїєґъыэ]/g, ch => map[ch] ?? "");
}

/** Використовується під час набору: мінімальна нормалізація, нічого не “блокує” */
function slugLive(value: string): string {
  let s = value.toLowerCase();
  s = _normalizeDashesSpaces(s);
  s = s.replace(/&/g, " and ");           // & → and (щоб не “з’їдалося” при фінальному фільтрі)
  s = _cyrillicToLatin(s);
  s = _asciiFold(s);
  // дозвіл тимчасово на будь-що — далі лише прибираємо подвійні дефіси і тримаємо форму
  s = s.replace(/[^a-z0-9-]+/g, "-");     // інше → дефіс (але не забороняє вводити “-”)
  s = s.replace(/-+/g, "-");
  return s;
}

/** Фінальна очистка (onBlur): прибирає крайні дефіси, порожнечу */
function slugFinal(value: string): string {
  let s = slugLive(value);
  s = s.replace(/^-+|-+$/g, "");
  return s;
}

/** Автогенерація зі Title (коли користувач ще не редагував slug вручну) */
function autoFromTitle(title?: string): string {
  if (!title) return "";
  return slugFinal(title);
}

/* --- Стислий статус-індикатор поля --- */
function FieldStatus({ ok, msg }: { ok: boolean; msg?: string }) {
  const tip = ok ? "OK" : (msg || "Invalid");
  return (
    <span
      className={`fb-status ${ok ? "ok" : "bad"}`}
      aria-label={tip}
      title={tip}
    >
      {ok ? "✓" : "!"}
    </span>
  );
}

const Req = () => <span className="fb-req" aria-hidden="true">*</span>;

/* --- Коротка назва файлу: перші 10 символів + … + розширення --- */
function shortFileName(name: string) {
  const base = name.split(/[/\\]/).pop() || name;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1) : "";
  const s = stem.length > 10 ? stem.slice(0, 10) + "…" : stem;
  return ext ? `${s}.${ext}` : s;
}

function SlugInput({
  value,
  title,
  onChange,
  maxLen = SEO.SLUG_MAX,
}: {
  value: string;
  title?: string;
  onChange: (v: string) => void;
  maxLen?: number;
}) {
  const [slugInput, setSlugInput] = React.useState<string>(value || "");
  const dirtyRef = React.useRef(false); // true — коли юзер редагував slug вручну і він НЕ порожній

  // синхронізація ззовні
  React.useEffect(() => { setSlugInput(value || ""); }, [value]);

  // ВАЖЛИВО: якщо slug порожній — знову дозволяємо автогенерацію з title
  React.useEffect(() => {
    const shouldAuto = !dirtyRef.current || slugInput.length === 0;
    if (shouldAuto) {
      const auto = autoFromTitle(title || "");
      const trimmed = auto.slice(0, maxLen);
      if (trimmed !== slugInput) {
        setSlugInput(trimmed);
        onChange(trimmed);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, maxLen, slugInput]); // slugInput у deps — безкінечного циклу не буде через перевірку

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let live = slugLive(e.target.value);
    if (live.length > maxLen) live = live.slice(0, maxLen);
    setSlugInput(live);
    onChange(live);
    // dirty = лише коли є хоч один символ; якщо стерли все — знову не dirty
    dirtyRef.current = live.length > 0;
  };

  const handleBlur = () => {
    let fin = slugFinal(slugInput);
    if (fin.length > maxLen) fin = fin.slice(0, maxLen);
    setSlugInput(fin);
    onChange(fin);
  };

  const len = slugInput.length;
  const bad = len > maxLen || (len > 0 && !SLUG_RE.test(slugInput));

  return (
    <div>
      <input
        className="fb-inp"
        value={slugInput}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="auto-from-title"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        maxLength={maxLen}
      />
      <div className={`fb-help ${bad ? "err" : ""}`}>{len}/{maxLen}</div>
      {bad && <div className="fb-help err">Only a–z, 0–9 and “-” are allowed</div>}
    </div>
  );
}

export default function Viewer({
  file,
  title,
  initialMeta,
  initialBookmarks = [],
}: {
  file: string;
  title?: string;
  initialMeta?: InitMeta;
  initialBookmarks?: InitBookmark[];
}) {
  const [error, setError] = useState<string | null>(null);

// NEW: pending color для кастомної палітри (лише попередній вибір)
const [customColor, setCustomColor] = useState<string>("#ffffff");

  // NEW: стан для модалки після успішної публікації
  const [pub, setPub] = useState<{ url: string } | null>(null);
  // Локальна назва завантаженого файлу (для відображення короткої назви)
  const [featuredName, setFeaturedName] = useState<string | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string>(file);
  // Ініціалізація контролера з безпечним catch (без setState у рендері)
  let ctrl: ReturnType<typeof useViewerController> | null = null;
  let initErr: string | null = null;
  try {
    ctrl = useViewerController({ file: pdfUrl, title });
  } catch (err: any) {
    initErr = typeof err === "string" ? err : err?.message || "Viewer component error";
  }

  // ⬇️⬇️ ВСТАВИТИ ФУНКЦІЮ ОДРАЗУ ПІСЛЯ try/catch ⬇️⬇️
  async function handleReplacePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.type !== "application/pdf") {
      notify("Only PDF allowed");
      e.currentTarget.value = ""; // дозволяє одразу вибрати той самий файл знову
      return;
    }

    try {
      const fd = new FormData();
      fd.append("pdf", f);
      // (опційно) якщо хочеш, щоб бек знав для якого слугу кладеш:
      if (ctrl?.meta?.slug) fd.append("slug", ctrl.meta.slug);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const out = await res.json().catch(() => ({} as any));
      if (!res.ok || !out?.url) throw new Error(out?.error || "Upload failed");

      // підміняємо активний PDF → контролер підтягне новий документ
      setPdfUrl(out.url);
    } catch (err: any) {
      notify(err?.message || "Replace failed");
    } finally {
      e.currentTarget.value = ""; // скинути інпут
    }
  }

const prefilledRef = React.useRef(false);
// --- EDIT MODE: preload meta + bookmarks (після готовності PDF) ---
useEffect(() => {
  if (!ctrl || !ctrl.pdfDoc || prefilledRef.current) return;

  // 1) META
  if (initialMeta) {
    ctrl.setMeta({
      title:       initialMeta.title,
      description: initialMeta.description,
      slug:        initialMeta.slug,
      featuredUrl: initialMeta.featuredUrl,
    });
  }

  // 2) BOOKMARKS (з санітизацією номерів сторінок під діапазон PDF)
  if (Array.isArray(initialBookmarks)) {
    const max = ctrl.pdfDoc.numPages;
    const safe = initialBookmarks.map((b) => ({
      ...b,
      page: Math.max(1, Math.min(max, Number(b.page) || 1)),
    }));

    // Використовуємо setBookmarks, якщо експортнутий з контролера; інакше fallback на replaceBookmarks
    (ctrl as any).setBookmarks?.(safe) ?? (ctrl as any).replaceBookmarks?.(safe);
  }
  prefilledRef.current = true;
}, [ctrl?.pdfDoc, initialMeta, initialBookmarks]);

// Режим редагування: є initialMeta.slug → slug фіксований (read-only у UI)
const isEdit = !!initialMeta?.slug;

// Валідація джерела PDF — залишаємо як було
if (!pdfUrl || typeof pdfUrl !== "string" || !/^https?:\/\/.+\.pdf(\?.*)?$/i.test(pdfUrl)) {
  return (
    <div
      style={{
        background: "#21353a",
        minHeight: "100vh",
        color: "#fff",
        padding: "80px 12px",
        textAlign: "center",
      }}
    >
      <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>
        Файл не знайдено або неправильний формат!
      </h2>
      <div style={{ color: "#aaa", marginTop: 12, fontSize: 16 }}>
        Передай коректний PDF через upload або URL.
      </div>
    </div>
  );
}

  // Помилка ініціалізації/роботи компонента
  if (initErr || error) {
    return (
      <div
        style={{
          background: "#21353a",
          minHeight: "100vh",
          color: "#fff",
          padding: "80px 12px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>Помилка перегляду PDF!</h2>
        <div style={{ color: "#aaa", marginTop: 12 }}>{initErr || error}</div>
      </div>
    );
  }

  // Очікуємо ініціалізацію контролера/документа
  if (!ctrl || !ctrl.pdfDoc) {
    return (
      <div
        style={{
          background: "#21353a",
          minHeight: "100vh",
          color: "#fff",
          padding: "80px 12px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}>Loading Flipbook…</h2>
      </div>
    );
  }

  /* брендова палітра для закладок */
  const brandColors = [
    "#f47e20",
    "#00647b",
    "#54c2bb",
    "#ac1f23",
    "#6b7034",
    "#4e667a",
    "#8a70a0",
    "#7e2c42",
  ];

// --- Валідації для статус-індикаторів (іконки лише для Title і Meta description) ---
const t = (ctrl.meta.title || "").trim();
const d = (ctrl.meta.description || "").trim();
const s = (ctrl.meta.slug || "").trim();

const titleOk = t.length >= 10 && t.length <= SEO.TITLE_MAX;
const descOk  = d.length >= 80 && d.length <= SEO.DESC_MAX;
const slugOk  = s.length >= 1 && s.length <= SEO.SLUG_MAX && SLUG_RE.test(s);
const imageOk = !!ctrl.meta.featuredUrl;

// === handlePublish (inline у компоненті) ===
async function handlePublish(): Promise<void> {
  if (!ctrl) return;

  const title = (ctrl.meta.title || "").trim();
  const desc  = (ctrl.meta.description || "").trim();
  const slug  = (ctrl.meta.slug || "").trim();

  const errs: string[] = [];
  if (!title) errs.push("Title is required");
  if (title.length < 10) errs.push("Title must be at least 10 characters");
  if (title.length > SEO.TITLE_MAX) errs.push(`Title exceeds ${SEO.TITLE_MAX} characters`);

  if (!desc) errs.push("Meta description is required");
  if (desc.length < 80) errs.push("Meta description must be at least 80 characters");
  if (desc.length > SEO.DESC_MAX) errs.push(`Meta description exceeds ${SEO.DESC_MAX} characters`);

  if (!slug) errs.push("Slug is required");
  if (slug.length > SEO.SLUG_MAX) errs.push(`Slug exceeds ${SEO.SLUG_MAX} characters`);
  if (!SLUG_RE.test(slug)) errs.push("Slug may contain only a–z, 0–9 and '-'");

  if (!ctrl.meta.featuredUrl) errs.push("Featured image is required");

  if (errs.length) { notify(errs.join("\n")); return; }

  try {
    // EDIT: оновлення існуючої сторінки
if (initialMeta?.slug) {
  const body: any = {
    meta: {
      title: ctrl.meta.title,
      description: ctrl.meta.description,
      featuredUrl: ctrl.meta.featuredUrl ?? null,
    },
    bookmarks: ctrl.bookmarks,
    file: pdfUrl, // ← новий/поточний PDF
  };

  if ((ctrl as any).publishedAt) body.publishedAt = (ctrl as any).publishedAt;

  const res = await fetch(`/api/directory/${encodeURIComponent(initialMeta.slug)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || "Update failed");

  const full =
    j?.publicUrl ||
    (j?.urlPath ? `${SITE_URL}${j.urlPath}` : `${SITE_URL}/directory/${initialMeta.slug}`);
  if (full) setPub({ url: full });
  return;
}


    // NEW: публікація нового запису
const r = await ctrl.publishMetaAndBookmarks();
const full = r?.publicUrl || (r?.urlPath ? `${SITE_URL}${r.urlPath}` : "");
if (full) setPub({ url: full });

  } catch (e: any) {
    console.error(e);
    notify(e?.message || "Publish failed");
  }
}
// === /handlePublish ===


  return (
    <div className="viewer-root">
      <EditorHeader
  title={ctrl.title}
  onSearch={ctrl.runSearch}
  isSearching={(ctrl as any).searching ?? false}
  file={pdfUrl}
  isFs={ctrl.isFs}
  toggleFullscreen={ctrl.toggleFullscreen}
  handleShare={ctrl.handleShare}
  onPublish={() => { void handlePublish(); }}
/>



      {/* Стікі панель зліва (overlay, не впливає на контейнери) */}
      <aside className="fb-sticky-panel" role="complementary" aria-label="Bookmarks & Meta">
        <div className="fb-panel-sec">
          <div className="fb-sec-h">Meta</div>

          {/* --- TITLE --- */}
          <label className="fb-field">
  <div className="fb-lab">
    Title <Req /> <FieldStatus ok={titleOk} msg="Min 10 & Max 60 characters" />
  </div>
  <input
    className="fb-inp"
    value={ctrl.meta.title}
    maxLength={SEO.TITLE_MAX}
    onChange={(e) => ctrl.setMeta({ title: e.target.value })}
  />
  <div className={`fb-help ${((ctrl.meta.title || "").length > SEO.TITLE_MAX) ? "err" : ""}`}>
    {(ctrl.meta.title || "").length}/{SEO.TITLE_MAX}
  </div>
</label>


          {/* --- META DESCRIPTION --- */}
          <label className="fb-field">
  <div className="fb-lab">
    Meta description <Req /> <FieldStatus ok={descOk} msg="Min 80 & Max 155 characters" />
  </div>
  <textarea
    className="fb-txt"
    rows={3}
    value={ctrl.meta.description}
    maxLength={SEO.DESC_MAX}
    onChange={(e) => ctrl.setMeta({ description: e.target.value })}
  />
  <div className={`fb-help ${((ctrl.meta.description || "").length > SEO.DESC_MAX) ? "err" : ""}`}>
    {(ctrl.meta.description || "").length}/{SEO.DESC_MAX}
  </div>
</label>


          {/* --- SLUG --- */}
<label className="fb-field">
  <div className="fb-lab">Slug <Req /></div>

  {isEdit ? (
    // EDIT MODE: показуємо, але не даємо редагувати
    <input
      className="fb-inp"
      value={(ctrl.meta.slug ?? "")}
      readOnly
      disabled
      title="Slug is fixed after publish"
    />
  ) : (
    // CREATE MODE: можна редагувати/генерувати
    <SlugInput
      value={ctrl.meta.slug ?? ""}
      title={ctrl.meta.title || ctrl.title}
      onChange={(v) => ctrl.setMeta({ slug: v as any })}
      maxLen={SEO.SLUG_MAX}
    />
  )}
</label>

{/* --- REPLACE WHOLE PDF --- */}
<div className="fb-field">
  <div className="fb-lab">Source PDF</div>

  <input
    id="replace-pdf"
    type="file"
    accept="application/pdf"
    style={{ display: "none" }}
    onChange={handleReplacePdf}
  />

  <div className="fb-row">
    {/* Було <button className="fb-link" ...> */}
    <label
      htmlFor="replace-pdf"
      className="fb-link"
      title="Replace the entire PDF"
    >
      Replace PDF
    </label>

    <span
      className="fb-file-name"
      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
    >
      {pdfUrl}
    </span>
  </div>
</div>



          {/* --- FEATURED IMAGE --- */}
<div className="fb-field">
  <div className="fb-lab">Featured image <Req /></div>

  {!ctrl.meta.featuredUrl && (
    <>
      <input
        id="featured-upload"
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;

          // 2MB hard limit (сповіщення у модалці alert)
          if (f.size > 2 * 1024 * 1024) { notify("Image must be ≤ 2MB."); return; }

          let toSend = f;
          try { toSend = await prepareFeaturedUnder200KB(f); } catch (ex) { console.warn(ex); }

          const fd = new FormData();
          fd.append("image", toSend);
          if (ctrl.meta.slug) fd.append("slug", ctrl.meta.slug);

          const res = await fetch("/api/upload-featured", { method: "POST", body: fd });
          const out = await res.json();
          if (out?.url) ctrl.setFeatured(out.url);
          else notify(out?.error || "Upload failed");
        }}
      />

      <div className="fb-row">
        <label htmlFor="featured-upload" className="fb-link" title="Choose file">Choose File</label>
      </div>
    </>
  )}

  {ctrl.meta.featuredUrl && (
    <div className="fb-thumb">
      <img src={ctrl.meta.featuredUrl} alt="Featured" />
      <button
        className="fb-x"
        onClick={() => { ctrl.setFeatured(null); }}
        title="Remove"
      >
        ×
      </button>
    </div>
  )}
</div>


        </div>

        <div className="fb-panel-sec">
          <div className="fb-sec-h">Bookmarks</div>

          {/* форма додавання: label + page (optional) */}
          <div className="fb-row fb-row-wrap">
            <input className="fb-inp" placeholder="Label" id="fb-bmk-label" />
            <input className="fb-inp fb-inp-narrow" placeholder={`Page#`} id="fb-bmk-page" inputMode="numeric" pattern="[0-9]*" />
          </div>

          {/* палітра кольорів + custom (підтвердження через +) */}
<div className="fb-row fb-colors">
  {brandColors.map((c) => (
    <button
      key={c}
      className="fb-color-swatch"
      title={c}
      style={{ background: c }}
      onClick={() => {
        const labelEl = document.getElementById("fb-bmk-label") as HTMLInputElement | null;
        const pageEl  = document.getElementById("fb-bmk-page")  as HTMLInputElement | null;
        const pageVal = pageEl?.value?.trim();
        const pageNum = pageVal ? Number(pageVal) : undefined;

        ctrl.addBookmark({
          page: isFinite(pageNum || NaN) ? pageNum : undefined,
          label: labelEl?.value,
          color: c as any
        });
        if (labelEl) labelEl.value = "";
        if (pageEl)  pageEl.value  = "";
      }}
    />
  ))}

  {/* label перед кастомним пікером */}
  <span className="fb-color-label">Custom:</span>

  {/* вибір кастомного кольору БЕЗ автостворення */}
  <input
    type="color"
    className="fb-color-picker"
    title="Custom color"
    value={customColor}
    onChange={(e) => setCustomColor(e.target.value || "#ffffff")}
  />

  {/* ПЛЮС = підтвердження додавання з обраним кастомним кольором */}
  <button
    className="lh-iconbtn"
    title="Add with selected color"
    onClick={() => {
      const labelEl = document.getElementById("fb-bmk-label") as HTMLInputElement | null;
      const pageEl  = document.getElementById("fb-bmk-page")  as HTMLInputElement | null;
      const pageVal = pageEl?.value?.trim();
      const pageNum = pageVal ? Number(pageVal) : undefined;

      ctrl.addBookmark({
        page: isFinite(pageNum || NaN) ? pageNum : undefined,
        label: labelEl?.value,
        color: (customColor || "#ffffff") as any
      });
      if (labelEl) labelEl.value = "";
      if (pageEl)  pageEl.value  = "";
    }}
    aria-label="Add bookmark with selected color"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </button>
</div>



          {/* список з редагуванням */}
          <ul className="fb-list">
            {ctrl.bookmarks.map((b) => (
              <li key={b.id} className="fb-item">
  <input
    className="fb-inp fb-inp-grow"
    value={b.label}
    onChange={(e) => (ctrl as any).updateBookmark?.(b.id, { label: e.target.value })}
    title="Edit label"
  />
  <input
    className="fb-inp fb-inp-num"
    inputMode="numeric"
    pattern="[0-9]*"
    value={String(b.page)}
    onChange={(e) => (ctrl as any).updateBookmark?.(b.id, { page: Number(e.target.value || 1) })}
    title="Edit page"
  />
  <input
    type="color"
    className="fb-color-picker mini"
    value={(b as any).color || "#ffffff"}
    onChange={(e) => (ctrl as any).updateBookmark?.(b.id, { color: e.target.value as any })}
    title="Edit color"
  />
  <button className="fb-link" onClick={() => ctrl!.goToBookmark(b.id)} title={`Go to page ${b.page}`}>Go</button>
  <button className="fb-del" onClick={() => ctrl!.removeBookmark(b.id)} title="Remove">✕</button>
</li>

            ))}
          </ul>
        </div>
      </aside>

      {/* Сцена між header/footer */}
      <section ref={ctrl.stageRef} className="viewer-stage">
        <div
          className={`book-container${ctrl.currentIndex === 0 && !ctrl.single ? " is-cover" : ""}`}
          style={{
            transition: "transform 500ms ease-in-out",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: ctrl.single ? Math.round(ctrl.baseSize.w * ctrl.fitScale) : Math.round(ctrl.baseSize.w * ctrl.fitScale * 2),
            height: Math.round(ctrl.baseSize.h * ctrl.fitScale),
            maxWidth: "100vw",
            maxHeight: "100vh",
            position: "relative",
            overflow: "visible",
          }}
        >
          <FlipBook
            ref={ctrl.bookRef}
            width={ctrl.baseSize.w}
            height={ctrl.baseSize.h}
            size="stretch"
            usePortrait={ctrl.single}
            showCover={!ctrl.single}
            flippingTime={600}
            maxShadowOpacity={0.2}
            drawShadow
            mobileScrollSupport
            startPage={ctrl.currentIndex}
            onFlip={(e: { data: number }) => ctrl!.setCurrentIndex(e.data)}
            style={{
              width: "100%",
              height: "100%",
              minWidth: 0,
              minHeight: 0,
              aspectRatio: ctrl.baseSize.w / ctrl.baseSize.h,
              overflow: "visible",
            }}
          >
            {Array.from({ length: ctrl.totalPages }).map((_, i) => {
              const pageNum = i + 1;
              const bmp = ctrl!.cacheRef.current.get(pageNum);
              const links: Array<{ x: number; y: number; w: number; h: number; href?: string; dest?: any }> = (bmp?.links as any) ?? [];

              return (
                <div
                  key={i}
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "#fff",
                    position: "relative"
                  }}
                  onMouseMove={(e) => ctrl!.handlePageMouseMove(e, pageNum)}
                  onMouseLeave={ctrl!.handlePageMouseLeave}
                >
                  {/* СТОРІНКА */}
                  {bmp ? (
                    <>
                      <img
                        src={bmp.url}
                        alt={`p${pageNum}`}
                        data-page-img="true"
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          pointerEvents: "none",
                          borderRadius: 2,
                          display: "block"
                        }}
                      />
                      {links?.length
                        ? links.map((L: typeof links[0], idx: number) =>
                            L.href ? (
                              <a
                                key={idx}
                                href={L.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pdf-link"
                                style={{
                                  position: "absolute",
                                  left: `${L.x * 100}%`,
                                  top: `${L.y * 100}%`,
                                  width: `${L.w * 100}%`,
                                  height: `${L.h * 100}%`,
                                }}
                              />
                            ) : (
                              <button
                                key={idx}
                                className="pdf-link"
                                title="Go to"
                                onClick={() => (L.dest ? (ctrl as any).goToDest?.(L.dest) : null)}
                                style={{
                                  position: "absolute",
                                  left: `${L.x * 100}%`,
                                  top: `${L.y * 100}%`,
                                  width: `${L.w * 100}%`,
                                  height: `${L.h * 100}%`,
                                }}
                              />
                            )
                          )
                        : null}
                    </>
                  ) : (
                    <div style={{ textAlign: "center", lineHeight: "350px", color: "#bbb" }}>Page loading…</div>
                  )}
                </div>
              );
            })}
          </FlipBook>

          {/* === OVERLAY ЗАКЛАДОК (завжди видимі) === */}
          {ctrl.bookmarks.length > 0 && (
            <div
              className="bm-tabs-overlay"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 200,
                overflow: "visible",
                pointerEvents: "none",
                // змінні
                ["--tabThickness" as any]: "36px",
                ["--tabLength" as any]: "140px",
                ["--tabTop" as any]: "36px",
                ["--tabGap" as any]: "0px",
              } as React.CSSProperties}
            >
              {(() => {
                const sorted = [...ctrl.bookmarks].sort((a, b) => a.page - b.page);

                const leftNow = ctrl.single
                  ? ctrl.currentIndex + 1
                  : (ctrl.currentIndex % 2 === 0 ? ctrl.currentIndex + 1 : ctrl.currentIndex);
                const rightNow = Math.min(leftNow + 1, ctrl.totalPages);

                return sorted.map((bm, i) => {
                  const sideIsLeft = ctrl.single ? bm.page < (ctrl.currentIndex + 1) : bm.page < leftNow;

                  const baseStyle: React.CSSProperties = {
                    position: "absolute",
                    top: `calc(var(--tabTop) + ${i} * (var(--tabLength) + var(--tabGap)))`,
                    width: "var(--tabThickness)",
                    height: "var(--tabLength)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 800,
                    lineHeight: 1,
                    border: "1px solid rgba(0,0,0,.18)",
                    boxShadow: "0 2px 6px rgba(0,0,0,.12)",
                    opacity: 0.98,
                    transition: "transform .18s ease, box-shadow .18s ease, filter .18s ease",
                    pointerEvents: "auto",
                    background: (bm as any).color || "#f47e20",
                    borderRadius: "0 10px 10px 0",
                  };

                  const sideStyle: React.CSSProperties = sideIsLeft
                    ? {
                        left: "calc(var(--tabThickness) * -1)",
                        transform: "rotate(180deg)",
                        transformOrigin: "center",
                      }
                    : {
                        right: "calc(var(--tabThickness) * -1)",
                      };

                  return (
                    <button
                      key={bm.id}
                      className={`bm-tab ${sideIsLeft ? "left" : "right"}${
                        (bm.page === leftNow || bm.page === rightNow) ? " active" : ""
                      }`}
                      title={`${bm.label} (p.${bm.page})`}
                      onClick={(e) => { e.preventDefault(); ctrl!.goToBookmark(bm.id); }}
                      style={{ ...baseStyle, ...sideStyle }}
                    >
                      <span
                        className="bm-tab__label"
                        style={{
                          maxHeight: "calc(var(--tabLength) - 10px)",
                          padding: "4px 0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          writingMode: "vertical-rl",
                          textOrientation: "mixed",
                        } as React.CSSProperties}
                      >
                        {bm.label}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          )}
          {/* === /OVERLAY ЗАКЛАДОК === */}
        </div>
      </section>

      <ViewerFooter
        refEl={ctrl.toolbarRef}
        isNarrow={ctrl.isNarrow}
        numPages={ctrl.totalPages}
        currentIndex={ctrl.currentIndex}
        canPrev={ctrl.canPrev}
        canNext={ctrl.canNext}
        goFirst={ctrl.goFirst}
        goPrev={ctrl.goPrev}
        goNext={ctrl.goNext}
        goLast={ctrl.goLast}
        pageJump={ctrl.pageJump}
        setPageJump={ctrl.setPageJump}
        submitJump={ctrl.submitJump}
        loupeOn={ctrl.loupeOn}
        setLoupeOn={ctrl.setLoupeOn}
        loupeState={ctrl.loupe}
        LOUPE_SIZE={ctrl.LOUPE_SIZE}
        LOUPE_ZOOM={ctrl.LOUPE_ZOOM}
      />

      {/* === Success Publish Modal === */}
      {pub && (
        <div className="pub-overlay" role="dialog" aria-modal="true" aria-labelledby="pub-title">
          <div className="pub-card">
            <div className="pub-check" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M20 7L9 18l-5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 id="pub-title">Published successfully</h3>
            <p className="pub-url" title={pub.url}>{pub.url}</p>
            <div className="pub-actions">
              <button className="ua-btn" onClick={() => navigator.clipboard?.writeText(pub.url)} title="Copy link">Copy link</button>
              <a className="ua-btn ua-btn--dark" href={pub.url} target="_blank" rel="noopener noreferrer" title="Open">Open</a>
              <button className="ua-btn slim" onClick={() => setPub(null)} title="Close">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* СТИЛІ */}
      <style jsx global>{`
        html, body {
          margin: 0;
          height: 100%;
          background: #21353a;
          overflow: hidden !important;
        }
        * { box-sizing: border-box; }
        :root { --hdr: 56px; --ftr: 64px; }
        @media (max-width: 680px) {
          :root { --hdr: 56px; --ftr: 72px; }
        }
        .viewer-root {
          min-height: 100dvh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          color: #fff;
          background: #21353a;
          overflow: hidden;
        }

        /* Закладка може виходити за межі сторінки FlipBook */
        .page, .page > div, .page .page-content { overflow: visible !important; }
        .page .page-content { position: relative; }

        .page-bookmark{
          transition:
            transform 0.21s cubic-bezier(.7,0,.2,1),
            width 0.21s cubic-bezier(.7,0,.2,1),
            height 0.21s cubic-bezier(.7,0,.2,1),
            font-size 0.21s cubic-bezier(.7,0,.2,1);
        }
        .page-bookmark.right:hover,
        .page-bookmark.left:hover{
          --bmScale: 1.07;
          width: 88px;
          height: 43px;
          font-size: 1.07em;
        }
        .page-bookmark.left { transform: translateX(calc(-100% + 2px)) scaleX(-1); }
        .page-bookmark.left .page-bookmark__txt { display:inline-block; transform: scaleX(-1); }
        .page-bookmark { backface-visibility: hidden; transform-style: preserve-3d; }

        .local-header { height: var(--hdr); min-height: var(--hdr); z-index: 120; }
        .local-footer { height: var(--ftr); min-height: var(--ftr); z-index: 101; }

        .viewer-stage {
          flex: 1 1 auto;
          width: 100%;
          min-height: 0;
          min-width: 0;
          display: flex;
          align-items: center;
          justifyContent: center;
          overflow: hidden;
        }

        .fb-inp[disabled] {
  opacity: .7;
  cursor: not-allowed;
  background: #f5f5f5;
}


        .book-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          min-width: 0;
          min-height: 0;
          transition: transform 500ms cubic-bezier(.7,0,.2,1);
        }
        .book-container.is-cover { transform: translateX(-24%); }
        @keyframes book-opening { 0% { transform: translateX(-24%); } 100% { transform: translateX(0); } }

        .pdf-link { border: 0; background: transparent; cursor: pointer; display: block; }
        .pdf-link:focus-visible { outline: 2px dashed rgba(28,121,228,.6); outline-offset: 1px; }

        /* --- Sticky left panel (overlay) --- */
        .fb-sticky-panel{
          position: fixed; left: 16px; top: calc(var(--hdr) + 16px);
          width: 340px; /* +20px */
          max-height: calc(100dvh - var(--hdr) - 32px);
          overflow: auto; z-index: 999;
          padding: 12px; background:#ffffffef; backdrop-filter: blur(6px);
          border:1px solid #e7ebdf; border-radius:.9rem;
          box-shadow:0 12px 28px rgba(0,0,0,.12); color:#2d3018;
        }
        .fb-panel-sec{ background:#fff; border:1px solid #e7ebdf; border-radius:.8rem; padding:10px 10px 12px; box-shadow:0 4px 12px rgba(0,0,0,.06); }
        .fb-panel-sec + .fb-panel-sec{ margin-top:12px; }
        .fb-sec-h{ font-weight:900; color:#2d3018; margin-bottom:6px; }
        .fb-field{ display:block; margin-bottom:8px; }
        .fb-lab{ font-size:12px; color:#5c6750; margin-bottom:4px; display:flex; align-items:center; gap:6px; }
        .fb-req{ color:#c63; font-weight:900; }
        .fb-status{
          display:inline-flex; align-items:center; justify-content:center;
          width:16px; height:16px; border-radius:999px; font-size:12px; line-height:1;
          border:1px solid currentColor; user-select:none;
        }
        .fb-status.ok { color:#2b7a36; background:#e8f6ea; }
        .fb-status.bad{ color:#a32020; background:#fdeaea; }

        .fb-inp, .fb-txt{ width:100%; border:1px solid #e7ebdf; border-radius:.6rem; padding:.45rem .6rem; color:#2d3018; background:#fff; }
        .fb-inp-narrow{ width:110px; }
        .fb-inp-num{ width:72px; text-align:center; }
        .fb-inp-grow{ flex:1; min-width:0; }
        .fb-row{ display:flex; align-items:center; gap:8px; }
        .fb-row-wrap{ flex-wrap:wrap; margin-bottom:10px; }
        .fb-help{ font-size:11px; color:#7b8571; margin-top:4px; }
        .fb-help.err{ color:#a32020; }

        .fb-file-name{ font-size:12px; color:#5c6750; }

        .fb-thumb{ position:relative; margin-top:8px; }
        .fb-thumb img{ width:100%; display:block; border-radius:.6rem; border:1px solid #e7ebdf; }
        .fb-thumb .fb-x{ position:absolute; top:4px; right:4px; background:#fff; border:1px solid #e7ebdf; border-radius:.5rem; width:28px; height:28px; line-height:0; }

        .fb-list{ list-style:none; margin:8px 0 0; padding:0; }
        .fb-item{ display:flex; align-items:center; gap:6px; padding:6px 0; border-top:1px dashed #ecefe7; }
        .fb-item:first-child{ border-top:0; }
        .fb-dot{ width:14px; height:14px; border-radius:50%; border:1px solid #d7dccf; flex:0 0 14px; }
        .fb-link{
  background:#fff;
  border:1px solid #e7ebdf;
  border-radius:.55rem;
  padding:.35rem .55rem;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  text-decoration:none;
    /* додайте для однаковості з label */
  appearance:none;
  -webkit-appearance:none;
  font: inherit;
  line-height: 1.1;
  white-space: nowrap;
}
        .fb-del{ background:#fff; border:1px solid #e7ebdf; border-radius:.55rem; width:28px; height:28px; }

        .fb-colors{ align-items:center; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .fb-color-swatch{ width:24px; height:24px; border-radius:50%; border:1px solid #d7dccf; }
        .fb-color-picker{ width:40px; height:32px; border:1px solid #e7ebdf; border-radius:.55rem; background:#fff; padding:0; }
        .fb-color-picker.mini{ width:32px; height:28px; }

        .ua-btn.file{
  font-size: 12px;
  padding: 3px 6px;
  line-height: 1.1;
}

        @media (max-width: 860px){ .fb-sticky-panel{ left:8px; width:min(92vw, 360px); } }

        .pub-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(10,14,14,.6);backdrop-filter:blur(2px)}
        .pub-card{width:min(680px,92vw);border-radius:16px;padding:22px 22px 18px;background:#fff;color:#1f2a22;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.28);animation:pop-in .24s cubic-bezier(.2,.8,.2,1)}
        @keyframes pop-in{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}
        .pub-check{width:84px;height:84px;margin:4px auto 10px;border-radius:999px;display:grid;place-items:center;background:radial-gradient(60% 60% at 50% 50%,#b6e3a2 0%,#79c266 100%);color:#0f3d1a;animation:pulse 880ms ease-out}
        .pub-check svg{width:44px;height:44px}
        @keyframes pulse{0%{transform:scale(.6);filter:saturate(.8);opacity:.5}60%{transform:scale(1.08)}100%{transform:scale(1);filter:saturate(1);opacity:1}}
        h3{margin:6px 0 10px;font-size:22px;font-weight:800;color:#21353a}
        .pub-url{margin:6px auto 14px;padding:10px 12px;max-width:100%;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;font-size:14px;line-height:1.3;border-radius:10px;background:#f5f7f2;color:#2a3328;word-break:break-all;border:1px solid #e5e9e0}
        .pub-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .ua-btn{border-radius:10px;padding:10px 14px;font-weight:700;border:1px solid #cfd8c6;background:#fff;color:#2d3018}
        .ua-btn--dark{background:#21353a;color:#fff;border-color:#21353a}
        .ua-btn.slim{padding:8px 12px}
        .ua-btn:hover{background:#f7faf4;border-color:#bfcdb0}
        .ua-btn--dark:hover{background:#2a4a56;border-color:#2a4a56}
      `}</style>
      <style dangerouslySetInnerHTML={{ __html: ctrl.globalCss }} />
    </div>
  );
}
