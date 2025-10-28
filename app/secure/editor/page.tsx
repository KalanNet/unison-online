// app/secure/editor/ClientEditor.tsx

"use client";

import React, { useRef, useState } from "react";

// Для рендеру PDF
import * as pdfjsLib from "pdfjs-dist/build/pdf";

import "pdfjs-dist/web/pdf.worker.entry";

// Тип для закладок
type Bookmark = {
  id: string;
  page: number;
  title: string;
  color: string;
};

export default function ClientEditor() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<number[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Завантаження PDF
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      const reader = new FileReader();
      reader.onload = async function () {
        const typedArray = new Uint8Array(this.result as ArrayBuffer);
        const doc = await pdfjsLib.getDocument({ data: typedArray }).promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNumber(1);
        renderPage(doc, 1); // рендер першу сторінку
        setBookmarks([]);
        setSearchHits([]);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Рендер сторінки в Canvas
  const renderPage = async (doc: any, pageNum: number) => {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
    }
  };

  // Перехід між сторінками
  const goToPage = (num: number) => {
    if (pdfDoc && num > 0 && num <= numPages) {
      setPageNumber(num);
      renderPage(pdfDoc, num);
    }
  };

  // Додавання закладки
  const addBookmark = () => {
    const title = prompt("Назва закладки:", `Сторінка ${pageNumber}`);
    if (title) {
      setBookmarks([
        ...bookmarks,
        {
          id: `${Date.now()}`,
          page: pageNumber,
          title,
          color: "#00647b",
        },
      ]);
    }
  };

  // Пошук по сторінці
  const handleSearch = async () => {
    if (!pdfDoc || !searchQuery.trim()) return;
    let hits: number[] = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((it: any) => it.str).join(" ");
      if (pageText.toLowerCase().includes(searchQuery.toLowerCase())) {
        hits.push(i);
      }
    }
    setSearchHits(hits);
    if (hits.length) goToPage(hits[0]);
  };

  // Перерендер сторінки коли змінюється pageNumber
  React.useEffect(() => {
    if (pdfDoc) {
      renderPage(pdfDoc, pageNumber);
    }
  }, [pdfDoc, pageNumber]);

  return (
    <div className="flipbook-editor-wrapper" style={{ maxWidth: 920, margin: "0 auto", padding: "2rem" }}>
      <h1>Flipbook Editor</h1>
      <div>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />
      </div>
      {pdfDoc && (
        <div style={{ marginTop: "1rem", display: "flex", gap: 24 }}>
          <div>
            <canvas ref={canvasRef} style={{ border: "1px solid #aaa", width: 600, height: 800 }}/>
            <div style={{ marginTop: 10 }}>
              <button onClick={() => goToPage(1)} disabled={pageNumber === 1}>Перша</button>
              <button onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber === 1}>Назад</button>
              <span style={{ margin: "0 16px" }}>
                Сторінка {pageNumber} із {numPages}
              </span>
              <button onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber === numPages}>Вперед</button>
              <button onClick={() => goToPage(numPages)} disabled={pageNumber === numPages}>Остання</button>
              <button onClick={addBookmark}>Закладка</button>
            </div>
            <div style={{ marginTop: 15 }}>
              <input
                type="text"
                placeholder="Пошук по PDF"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 180 }}
              />
              <button onClick={handleSearch}>Пошук</button>
              {searchHits.length > 0 && (
                <span style={{ marginLeft: 12 }}>
                  Знайдено на сторінках: {searchHits.join(", ")}
                </span>
              )}
            </div>
          </div>
          <div>
            <h3>Закладки</h3>
            <ul>
              {bookmarks.map(bm => (
                <li key={bm.id}>
                  <button style={{ color: bm.color }} onClick={() => goToPage(bm.page)}>
                    {bm.title} (стор. {bm.page})
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
