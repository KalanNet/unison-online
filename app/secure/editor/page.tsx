// app/secure/editor/page.tsx
import type { Metadata } from "next";

export const runtime = "edge";           // <— ДОДАТИ
export const dynamic = "force-dynamic";  // лишаємо як є

export const metadata: Metadata = {
  title: "Flipbook Editor",
  robots: { index: false, follow: false, nocache: true },
};

// Імпортуємо клієнтський компонент напряму — ок
import ClientEditor from "./ClientEditor";

export default function EditorPage() {
  return <ClientEditor />;
}
