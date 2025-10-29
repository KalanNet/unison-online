// =========================================================
// Flipbook Editor — Cloudflare R2 (Client-Side Upload)
// https://cdn.unisonalberta.online
// =========================================================

"use client";

import React, { useState } from "react";
import { useViewerController } from "./useEditorController";
import EditorHeader from "./EditorHeader";

// -------------------------
// 1. Основний компонент
// -------------------------
export default function ClientEditor() {
  // -------------------------
  // 2. Стейти
  // -------------------------
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------
  // 3. Хендлер upload PDF через Cloudflare Worker
  // -------------------------
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("pdf", f);

      // !!! ВАЖЛИВО: заміни на прод/worker endpoint:
      // Наприклад, якщо твій Worker на https://pdfup.unisonalberta.workers.dev/upload
      // const API_ENDPOINT = "https://pdfup.unisonalberta.workers.dev/upload";
      const API_ENDPOINT = "/api/upload"; // для development/local, для production — реальний Worker URL

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

  // -------------------------
  // 4. Контролер перегляду PDF (fileUrl)
  // -------------------------
  const ctrl = fileUrl ? useViewerController({ file: fileUrl }) : null;

  // -------------------------
  // 5. Рендер UI — upload/перегляд
  // -------------------------
  return (
    <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "60px 0 0 0" }}>
      {!fileUrl ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
          <h1 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 28, marginBottom: 32 }}>Flipbook Editor</h1>
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
            {loading ? "Завантаження..." : "Оберіть PDF-файл для початку роботи"}
          </div>
          {error && <div style={{ color: "#e54", marginTop: 20 }}>{error}</div>}
        </div>
      ) : (
        <>
          {ctrl && (
            <>
              <EditorHeader
                title={ctrl.title}
                page={ctrl.currentIndex + 1}
                totalPages={ctrl.totalPages}
                onPrev={ctrl.goPrev}
                onNext={ctrl.goNext}
                canPrev={ctrl.canPrev}
                canNext={ctrl.canNext}
                searchQuery={ctrl.searchQuery}
                setSearchQuery={ctrl.setSearchQuery}
                runSearch={ctrl.runSearch}
                isFs={ctrl.isFs}
                toggleFullscreen={ctrl.toggleFullscreen}
                handleShare={ctrl.handleShare}
              />
              {/* Тут буде Flipbook, футер і сторінки */}
            </>
          )}
        </>
      )}
    </div>
  );
}

