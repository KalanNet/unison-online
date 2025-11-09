// app/secure/editor/ClientEditor.tsx
"use client";

import React, { useEffect, useState } from "react";
import Viewer from "app/components/Viewer";

export default function ClientEditor() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- published links ----
  const [links, setLinks] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // app/secure/editor/ClientEditor.tsx  — секція useEffect для Published
useEffect(() => {
  let alive = true;
  (async () => {
    try {
      setListLoading(true);

      // Канонічний шлях
      let r = await fetch("/api/list-published", { cache: "no-store" });

      // Fallback на стару адресу (працюватиме через аліас вище)
      if (!r.ok) r = await fetch("/api/directory/list-published", { cache: "no-store" });

      const j = await r.json().catch(() => ({ links: [] }));
      if (alive) setLinks(Array.isArray(j?.links) ? j.links : []);
    } catch {
      if (alive) setLinks([]);
    } finally {
      if (alive) setListLoading(false);
    }
  })();
  return () => { alive = false; };
}, []);


  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("pdf", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const out = await res.json();
      if (!out.url) throw new Error("No URL received from API");
      setFileUrl(out.url);
    } catch (ex: any) {
      setError(typeof ex === "string" ? ex : ex?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (!fileUrl) {
    return (
      <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff" }}>
        {/* header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
          <h1 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 28, marginBottom: 32 }}>
            Flipbook Creator/Editor
          </h1>
          <input
            type="file"
            accept="application/pdf"
            disabled={loading}
            style={{ background:"#fff", color:"#222", padding:"12px 24px", borderRadius:6,
                     fontWeight:700, border:"1px solid #8ea05a", width:340, fontSize:18 }}
            onChange={handleUpload}
          />
          <div style={{ marginTop: 22, color: "#bbb", fontSize: 17 }}>
            {loading ? "Loading..." : "Please select a PDF file to begin."}
          </div>
          {error && <div style={{ color: "#e54", marginTop: 20 }}>{error}</div>}
        </div>

        {/* published list */}
        <div style={{ maxWidth: 960, margin: "48px auto 80px", padding: "0 16px" }}>
          <h3 style={{ color: "#f4ce69", fontWeight: 800, margin: "0 0 10px" }}>Published</h3>
          {listLoading && <div style={{ color: "#bbb" }}>Loading…</div>}
          {!listLoading && !links.length && <div style={{ color: "#bbb" }}>No items.</div>}

          {!!links.length && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {links.sort((a,b)=>a.localeCompare(b)).map((href) => (
                <li key={href}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
                             borderTop:"1px dashed rgba(255,255,255,.1)" }}>
                  <a href={href} target="_blank" rel="noopener noreferrer"
                     style={{ color:"#fff", textDecoration:"none", flex:"1 1 auto", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {href}
                  </a>
                  <a href={href} target="_blank" rel="noopener noreferrer"
                     className="ua-btn ua-btn--dark" title="Open public">Go</a>
                  <button className="ua-btn" disabled title="Edit (disabled)">Edit</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <style jsx global>{`
          .ua-btn{
            border-radius:10px; padding:8px 12px; font-weight:700;
            border:1px solid #cfd8c6; background:#fff; color:#2d3018;
          }
          .ua-btn[disabled]{ opacity:.55; cursor:not-allowed }
          .ua-btn--dark{ background:#21353a; color:#fff; border-color:#21353a }
          .ua-btn--dark:hover{ background:#2a4a56; border-color:#2a4a56 }
        `}</style>
      </div>
    );
  }

  return <Viewer file={fileUrl} />;
}
