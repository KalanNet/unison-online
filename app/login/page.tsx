// app/(login)/page.tsx
import type { Metadata } from "next";
import ClientLoginForm from "./ClientLoginForm";

export const dynamic = "force-dynamic"; // ВАЖЛИВО: дозволяє читати ?next=... на рендері

export const metadata: Metadata = {
  title: "Secure Access",
  robots: { index: false, follow: false, nocache: true },
};

// санітизація next, щоб не було open redirect
function normalizeNext(raw?: string) {
  const def = "/secure/editor";
  if (!raw) return def;

  // забороняємо протоколи / зовнішні хости / подвійний слеш
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return def;
  if (raw.startsWith("//")) return def;

  // має бути внутрішній абсолютний шлях
  if (!raw.startsWith("/")) return def;

  // якщо передали домашню, все одно йдемо в редактор
  if (raw === "/") return def;

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
