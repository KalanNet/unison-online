// app/secure/editor/ClientEditor.tsx
"use client";

import React, { useState } from "react";
import { useViewerController } from "./useEditorController";
// import EditorHeader, EditorFooter, EditorBookmarks, EditorSearch

export default function ClientEditor() {
  // state для input[file] якщо потрібно
  const [file, setFile] = useState<string | null>(null);

  // Якщо файл обраний, ініціалізувати ctrl
  const ctrl = file ? useViewerController({ file }) : null;

  // input[file] — оновлює state file
  // ctrl — всі функції/стани для UI
  // UI — хедер, тулбар, сторінка, закладки, пошук, etc.

  return (
    <div>
      {!file ?
        <input type="file" accept="application/pdf" onChange={e => {
          const f = e.target.files?.[0];
          if (f) setFile(URL.createObjectURL(f));
        }} />
        :
        <>
          {/* Ці компоненти отримують props з ctrl */}
          {/* <EditorHeader {...ctrl}/> */}
          {/* <EditorBookmarks {...ctrl}/> */}
          {/* <EditorFooter {...ctrl}/> */}
          {/* <EditorSearch {...ctrl}/> */}
        </>
      }
    </div>
  )
}
