// app/secure/editor/page.tsx
import type { Metadata } from "next";
import ClientEditor from "./ClientEditor";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flipbook Editor",
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  // Ніяких props — редактор сам читає slug з URL на клієнті
  return <ClientEditor />;
}
