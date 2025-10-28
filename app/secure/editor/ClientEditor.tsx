// app/secure/editor/ClientEditor.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useViewerController } from "./useEditorController";
import EditorHeader from "./EditorHeader";

export default function ClientEditor() {
  const [file, setFile] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (file) URL.revokeObjectURL(file);
    };
  }, [file]);

  const ctrl = file ? useViewerController({ file }) : null;

  return (
    <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff", padding: "60px 0 0 0" }}>
      {!file ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
          <h1 style={{ color: "#f4ce69", fontWeight: "900", fontSize: 28, marginBottom: 32 }}>Flipbook Editor</h1>
          <input
            type="file"
            accept="application/pdf"
            style={{ background: "#fff", color: "#222", padding: "12px 24px", borderRadius: 6, fontWeight: 700, border: "1px solid #8ea05a", width: 340, fontSize: 18 }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) setFile(URL.createObjectURL(f));
            }}
          />
          <div style={{ marginTop: 22, color: "#bbb", fontSize: 17 }}>Оберіть PDF-файл для початку роботи</div>
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
              {/* Тут буде Flipbook + футер, коли долучите */}
            </>
          )}
        </>
      )}
    </div>
  );
}
