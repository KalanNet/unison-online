// app/secure/editor/EditorHeader.tsx
"use client";

import React from "react";

type Props = {
  title?: string;
  /** виклик пошуку (в editor показуємо prompt) */
  onSearch: (q: string) => void;
  isSearching?: boolean;

  /** для кнопки Download */
  file: string;

  /** fullscreen */
  isFs: boolean;
  toggleFullscreen: () => void;

  /** share */
  handleShare: () => void;

  /** publish */
  onPublish: () => void;
};

export default function EditorHeader({
  title,
  onSearch,
  isSearching,
  file,
  isFs,
  toggleFullscreen,
  handleShare,
  onPublish,
}: Props) {
  const runPromptSearch = () => {
    const q = prompt("Search in PDF:");
    if (q) onSearch(q);
  };

  return (
    <header className="local-header" style={{ background: "#fafbf8", borderBottom: "1px solid #e9ede3" }}>
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0px 12px",
          color: "#2d3018",
        }}
      >
        <h1
          title={title}
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: ".2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "50vw",
          }}
        >
          {title || "Flipbook Editor"}
        </h1>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Search */}
          <button
            className="lh-iconbtn"
            onClick={runPromptSearch}
            title="Search"
            disabled={!!isSearching}
            aria-label="Search"
          >
            {/* magnifier */}
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M20 20l-4.35-4.35" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>

          {/* Download */}
          <a className="lh-iconbtn" href={file} download title="Download PDF" aria-label="Download">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 21h16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </a>

          {/* Share */}
          <button className="lh-iconbtn" onClick={handleShare} title="Share" aria-label="Share">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M12 16V4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M8 8l4-4 4 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Fullscreen */}
          <button
            className="lh-iconbtn"
            title={isFs ? "Exit full screen" : "Full screen"}
            onClick={toggleFullscreen}
            aria-label={isFs ? "Exit full screen" : "Full screen"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 3H5a2 2 0 0 0-2 2v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M3 15v4a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M15 3h4a2 2 0 0 1 2 2v4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M21 15v4a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>

          {/* Publish */}
          <button
            className="lh-btn"
            onClick={onPublish}
            title="Publish"
            aria-label="Publish"
            style={{ fontWeight: 800 }}
          >
            Publish
          </button>
        </div>
      </div>

      {/* локальні стилі іконкокнопок, як у старому проекті */}
      <style jsx>{`
        .lh-btn {
          background: #fff;
          color: #2d3018;
          border: 1px solid #e7ebdf;
          padding: .45rem .8rem;
          border-radius: .7rem;
          box-shadow: 0 4px 12px rgba(0,0,0,.06);
        }
        .lh-iconbtn {
          background: #fff;
          border: 1px solid #e7ebdf;
          border-radius: .65rem;
          padding: .42rem .6rem;
          line-height: 0;
          display: inline-grid;
          place-items: center;
          color: #2d3018;
          box-shadow: 0 4px 12px rgba(0,0,0,.06);
        }
        .lh-iconbtn[disabled] { opacity: .5; pointer-events: none; }
      `}</style>
    </header>
  );
}
