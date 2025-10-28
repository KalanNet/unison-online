// app/secure/editor/page.tsx
import type { Metadata } from "next";
import ClientEditor from "./ClientEditor"; // <— просто імпорт клієнтського компонента

export const dynamic = "force-dynamic";

// noindex — внутрішня сторінка
export const metadata: Metadata = {
  title: "Flipbook Editor",
  robots: { index: false, follow: false, nocache: true },
};

export default function EditorPage() {
  return <ClientEditor />;
}
