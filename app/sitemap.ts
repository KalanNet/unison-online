// app/sitemap.ts
import type { MetadataRoute } from "next";

/**
 * Production sitemap generator
 * - Бере базовий URL сайту, але завжди форсить прод-домен unisonalberta.online.
 * - Тягне індекс каталогу з R2 (directory/index.json) і будує /directory/[slug].
 * - Акуратно обробляє різні формати index.json (масив рядків, масив об'єктів, map-об'єкт).
 * - Ігнорує службові ключі generatedAt / items.
 * - Якщо R2 недоступний — віддає лише головну.
 *
 * ВАЖЛИВО: жодних `export const runtime` / `export const revalidate` тут.
 * Кеш контролюється тільки через fetch().
 */

// 6 годин кешу sitemap при фетчі index.json
const SITEMAP_REVALIDATE = 60 * 60 * 6;

// Базовий сайт: навіть якщо env містить dev-домен — примусово використовуємо прод
const RAW_SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "";
const SITE = /unisonalberta\.online$/.test(RAW_SITE)
  ? RAW_SITE
  : "https://unisonalberta.online";

const R2_PUBLIC =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/+$/, "") ||
  "https://cdn.unisonalberta.online";

// Спроба прочитати і нормалізувати directory index з R2
async function fetchDirectorySlugs(): Promise<
  { slug: string; lastModified?: string | Date }[]
> {
  const INDEX_URL = `${R2_PUBLIC}/directory/index.json`;

  const r = await fetch(INDEX_URL, {
    next: { revalidate: SITEMAP_REVALIDATE },
    cache: "force-cache",
  });

  if (!r.ok) throw new Error(`index.json HTTP ${r.status}`);
  const data = await r.json();

  // 🔹 0) Новий основний формат:
  // {
  //   "generatedAt": "...",
  //   "items": [ { slug: "...", updatedAt: "...", ... }, ... ]
  // }
  if (data && typeof data === "object" && Array.isArray((data as any).items)) {
    const items = (data as any).items as any[];
    return items
      .map((row) => ({
        slug: String(row.slug ?? row.id ?? row.name ?? "").trim(),
        lastModified:
          row.updatedAt ??
          row.publishedAt ??
          row.lastModified ??
          row.date ??
          undefined,
      }))
      .filter((x) => x.slug);
  }

  // 1) Старий простий формат: ["abc","def"]
  if (Array.isArray(data) && data.every((v) => typeof v === "string")) {
    return (data as string[]).map((slug) => ({ slug }));
  }

  // 2) Старий розширений формат: [{slug:"abc", updatedAt:"..."}, {...}]
  if (Array.isArray(data) && data.length && typeof data[0] === "object") {
    return (data as any[])
      .map((row) => ({
        slug: String(row.slug ?? row.id ?? row.name ?? "").trim(),
        lastModified:
          row.updatedAt ??
          row.publishedAt ??
          row.lastModified ??
          row.date ??
          undefined,
      }))
      .filter((x) => x.slug);
  }

  // 3) Map-об'єкт: {"abc": {...}, "def": {...}} або {"abc": "2025-01-01"}
  if (data && typeof data === "object") {
    return Object.entries<any>(data)
      .map(([slug, v]) => ({
        slug,
        lastModified:
          (v &&
            (v.updatedAt ||
              v.publishedAt ||
              v.lastModified ||
              v.date)) ||
          undefined,
      }))
      // відкидаємо службові ключі з нового формату
      .filter(
        (x) =>
          x.slug &&
          x.slug !== "generatedAt" &&
          x.slug !== "items"
      );
  }

  // Незнайомий формат
  throw new Error("Unsupported index.json format");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Базові (публічні) сторінки
  const items: MetadataRoute.Sitemap = [
    {
      url: `${SITE}/`,
      changeFrequency: "weekly",
      priority: 0.9,
      lastModified: new Date(),
    },
  ];

  try {
    const entries = await fetchDirectorySlugs();

    for (const { slug, lastModified } of entries) {
      const url = `${SITE}/directory/${encodeURIComponent(slug)}`;
      items.push({
        url,
        changeFrequency: "weekly",
        priority: 0.8,
        ...(lastModified
          ? { lastModified: new Date(lastModified) }
          : undefined),
      });
    }
  } catch {
    // Якщо index.json недоступний — sitemap все одно валідний (тільки головна)
  }

  return items;
}
