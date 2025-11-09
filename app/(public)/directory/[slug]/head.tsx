// app/(public)/directory/[slug]/head.tsx
export const runtime = "edge";

const R2_PUBLIC =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.unisonalberta.online";

export default function Head({ params }: { params: { slug: string | string[] } }) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug || "";
  const metaUrl = `${R2_PUBLIC}/directory/${encodeURIComponent(slug)}/meta.json`;
  const origin = new URL(metaUrl).origin;

  return (
    <>
      {/* DNS/TCP/TLS наперед */}
      <link rel="dns-prefetch" href={origin} />
      <link rel="preconnect" href={origin} crossOrigin="" />
      {/* Ранній fetch meta.json у браузері */}
      <link rel="preload" as="fetch" href={metaUrl} crossOrigin="anonymous" />
    </>
  );
}
