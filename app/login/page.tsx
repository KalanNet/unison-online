// app/(login)/page.tsx
import type { Metadata } from "next";
import ClientLoginForm from "./ClientLoginForm";

export const runtime = "edge";          // <-- ВАЖЛИВО для Cloudflare Pages
export const dynamic = "force-dynamic"; // читаємо ?next=... на рендері

export const metadata: Metadata = {
  title: "Secure Access",
  robots: { index: false, follow: false, nocache: true },
};

// санітизація next, щоб уникнути open redirect
function normalizeNext(raw?: string) {
  const def = "/secure/editor";
  if (!raw) return def;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return def; // протоколи
  if (raw.startsWith("//")) return def;                   // двійний слеш (інший хост)
  if (!raw.startsWith("/")) return def;                   // має бути внутрішній шлях
  if (raw === "/") return def;                            // не ведемо на домашню
  return raw;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextUrl = normalizeNext(searchParams?.next);
  return <ClientLoginForm nextUrl={nextUrl} />;
}
