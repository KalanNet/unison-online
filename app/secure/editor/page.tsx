import type { Metadata } from "next";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flipbook Editor",
  robots: { index: false, follow: false, nocache: true },
};

import ClientEditor from "./ClientEditor";

export default function EditorPage() {
  return <ClientEditor />;
}
