// app/secure/editor/ClientEditor.tsx

"use client";

import React, { useState } from "react";
import Viewer from "app/components/Viewer";
 
export default function ClientEditor() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("pdf", f);
      const API_ENDPOINT = "/api/upload";
      const res = await fetch(API_ENDPOINT, { method: "POST", body: fd });
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

  return (
    <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "0 0 0 0" }}>
      {!fileUrl ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
          <h1 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 28, marginBottom: 32 }}>Flipbook Creator/Editor</h1>
          <input
            type="file"
            accept="application/pdf"
            disabled={loading}
            style={{
              background: "#fff", color: "#222", padding: "12px 24px", borderRadius: 6,
              fontWeight: 700, border: "1px solid #8ea05a", width: 340, fontSize: 18
            }}
            onChange={handleUpload}
          />
          <div style={{ marginTop: 22, color: "#bbb", fontSize: 17 }}>
            {loading ? "Завантаження..." : "Please select a PDF file to begin."}
          </div>
          {error && <div style={{ color: "#e54", marginTop: 20 }}>{error}</div>}
        </div>
      ) : (
        <Viewer file={fileUrl} />
      )}
    </div>
  );
}
