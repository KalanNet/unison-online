// app/(login)/page.tsx
import type { Metadata } from "next";
import ClientLoginForm from "./ClientLoginForm";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Secure Access",
  robots: { index: false, follow: false, nocache: true },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextUrl = searchParams?.next || "/";
  return <ClientLoginForm nextUrl={nextUrl} />;
}
