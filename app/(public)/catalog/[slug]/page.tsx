// app/(public)/catalog/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicViewer from "app/public/PublicViewer";

const CDN = "https://cdn.unisonalberta.online";

type CatalogMetaPayload = {
  meta: {
    title: string;
    description: string;
    featuredUrl?: string | null;
    slug?: string;
  };
  bookmarks?: Array<{ id: string; page: number; label: string; color?: string | null }>;
  file: string; // public PDF URL
};

async function fetchMetaBySlug(slug: string): Promise<CatalogMetaPayload | null> {
  // Підтримуємо 2 патерни збереження:
  // 1) /catalog/<slug>/meta.json
  // 2) /<slug>.meta.json   (коли meta лежить поруч з PDF на корені)
  const candidates = [
    `${CDN}/catalog/${encodeURIComponent(slug)}/meta.json`,
    `${CDN}/${encodeURIComponent(slug)}.meta.json`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (res.ok) return (await res.json()) as CatalogMetaPayload;
    } catch {
      /* ignore and try next */
    }
  }
  return null;
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const data = await fetchMetaBySlug(params.slug);

  const title = data?.meta?.title || "Catalog";
  const description = data?.meta?.description || "Directory viewer";
  const img = data?.meta?.featuredUrl || `${CDN}/og-default.jpg`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [img],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [img],
    },
  };
}

export default async function Page({ params }: { params: { slug: string } }) {
  const data = await fetchMetaBySlug(params.slug);
  if (!data?.file) notFound();

  return (
    <PublicViewer
      file={data.file}
      title={data.meta?.title || params.slug}
    />
  );
}
