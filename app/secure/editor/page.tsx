// app/secure/editor/page.tsx
import type { Metadata } from "next";
import nextDynamic from "next/dynamic"; // <-- переіменували імпорт

export const dynamic = "force-dynamic";

// noindex — внутрішня сторінка
export const metadata: Metadata = {
  title: "Flipbook Editor",
  robots: { index: false, follow: false, nocache: true },
};

// Клієнтський редактор (форма публікації)
const ClientEditor = nextDynamic(() => import("app/secure/editor/ClientEditor"), { ssr: false });

export default function EditorPage() {
  return <ClientEditor />;
}
