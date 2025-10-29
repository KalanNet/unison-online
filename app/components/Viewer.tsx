// components/Viewer.tsx
"use client";

import React, { useState } from "react";
import { useViewerController } from "../secure/editor/useEditorController";
import EditorHeader from "../secure/editor/EditorHeader";

// -------------------------------
// Viewer — Flipbook PDF Shell
// -------------------------------

export default function Viewer({
  file,
  title,
}: {
  file: string;
  title?: string;
}) {
  // -------------------
  // 1. State
  // -------------------
  const [error, setError] = useState<string | null>(null);

  // -------------------
  // 2. Controller — підключення хука
  // -------------------
  let ctrl: ReturnType<typeof useViewerController> | null = null;

  try {
    ctrl = useViewerController({ file, title });
  } catch (err: any) {
    setError(
      typeof err === "string" ? err : err?.message || "Viewer component error"
    );
  }

  // -------------------
  // 3. Валідація URL
  // -------------------
  if (!file || typeof file !== "string" || !/^https?:\/\/.+\.pdf$/.test(file)) {
    return (
      <div
        style={{
          background: "#21353a",
          minHeight: "100vh",
          color: "#fff",
          padding: "80px 12px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>
          Файл не знайдено або неправильний формат!
        </h2>
        <div style={{ color: "#aaa", marginTop: 12, fontSize: 16 }}>
          Будь ласка, передайте коректний PDF через upload або URL.
        </div>
      </div>
    );
  }

  // -------------------
  // 4. Error Boundary
  // -------------------
  if (error) {
    return (
      <div
        style={{
          background: "#21353a",
          minHeight: "100vh",
          color: "#fff",
          padding: "80px 12px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#e54", fontWeight: 900, fontSize: 22 }}>
          Помилка перегляду PDF!
        </h2>
        <div style={{ color: "#aaa", marginTop: 12 }}>{error}</div>
      </div>
    );
  }

  if (!ctrl) {
    // Initial mounting/loading pdf.js
    return (
      <div
        style={{
          background: "#21353a",
          minHeight: "100vh",
          color: "#fff",
          padding: "80px 12px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 22 }}>
          Завантаження Flipbook...
        </h2>
      </div>
    );
  }

  // -------------------
  // 5. Main Render
  // -------------------

  return (
    <div
      style={{
        background: "#21353a",
        minHeight: "100vh",
        color: "#fff",
        padding: "60px 0 0 0",
      }}
      className="viewer-root"
    >
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
      {/* TODO: Тут буде Flipbook, сторінки, loupe, футер */}
      {/* Можна додати ViewerFooter, Flipbook компонент, панель навігації по бажанню */}
      {/* Через ctrl.bookRef/ctrl.stageRef — рендерити Flipbook */}
    </div>
  );
}
