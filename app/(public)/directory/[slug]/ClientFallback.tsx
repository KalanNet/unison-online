"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type MetaPayload = { meta?: { title?: string }; file?: string };

export default function ClientFallback() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [ready, setReady] = useState<{ file: string; title?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const m = pathname?.match(/\/directory\/([^/?#]+)/i);
    const slug = m?.[1];
    if (!slug) {
      setErr("Missing slug in /directory/[slug].");
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/directory/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (r.ok) {
          const data = (await r.json()) as MetaPayload;
          if (data?.file) {
            setReady({ file: data.file, title: data.meta?.title || slug });
            return;
          }
        }
        // останній шанс: ?file=
        const file = sp.get("file");
        if (file) setReady({ file, title: "Preview" });
        else setErr(`Expected meta at /api/directory/${slug}`);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [pathname, sp]);

  if (ready) {
    const PublicViewer = require("app/public/PublicViewer").default;
    return <PublicViewer file={ready.file} title={ready.title} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Not found</h2>
      <p>{err ?? "Loading…"}</p>
    </div>
  );
}
