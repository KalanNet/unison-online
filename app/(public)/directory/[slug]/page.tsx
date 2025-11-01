import type { Metadata } from "next";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type MetaPayload = {
  meta?: { title?: string; description?: string; featuredUrl?: string | null };
  file?: string;
};

async function getMeta(slug: string): Promise<MetaPayload | null> {
  // відносний виклик внутрішнього API працює на Edge
  const r = await fetch(`/api/directory/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!r.ok) return null;
  return (await r.json()) as MetaPayload;
}

export async function generateMetadata({
  params,
}: { params: { slug: string | string[] } }): Promise<Metadata> {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const data = slug ? await getMeta(slug) : null;
  const title = data?.meta?.title ?? `Directory — ${slug ?? ""}`;
  const description = data?.meta?.description ?? "Unison Alberta directory viewer.";
  const ogImg = data?.meta?.featuredUrl ?? "https://unison-online-dev.pages.dev/og.jpg";
  return { title, description, openGraph: { title, description, images: [ogImg] } };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string | string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  // SSR спроба
  const data = slug ? await getMeta(slug) : null;

  // Фолбек: якщо meta нема — дозволяємо ?file=
  if (!data?.file) {
    if (typeof searchParams.file === "string" && searchParams.file) {
      const PublicViewer = (await import("app/public/PublicViewer")).default;
      return <PublicViewer file={searchParams.file} title="Preview" />;
    }
    // клієнтський «слухач» підстрахує (п.3)
    const ClientFallback = (await import("app/(public)/directory/[slug]/ClientFallback")).default;
    return <ClientFallback />;
  }

  const PublicViewer = (await import("app/public/PublicViewer")).default;
  const title = data.meta?.title || slug;
  return <PublicViewer file={data.file} title={title} />;
}
