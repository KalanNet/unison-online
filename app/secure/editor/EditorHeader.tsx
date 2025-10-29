// app/secure/editor/EditorHeader.tsx
"use client";

type Props = {
  title?: string;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  runSearch: (q: string) => void;
  isFs: boolean;
  toggleFullscreen: () => void;
  handleShare: () => void;
};

export default function EditorHeader({
  title,
  page,
  totalPages,
  onPrev,
  onNext,
  canPrev,
  canNext,
  searchQuery,
  setSearchQuery,
  runSearch,
  isFs,
  toggleFullscreen,
  handleShare,
}: Props) {
  return (
    <header
      className="local-header"
      style={{
        background: "#fafbf8",
        padding: "8px 20px",
        borderBottom: "1px solid #e9ede3",
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: "#2d3018",
      }}
    >
      <span style={{ fontWeight: 900, fontSize: 18, marginRight: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {title || "Flipbook Editor"}
      </span>

      <span style={{ marginRight: 16, opacity: 0.85, whiteSpace: "nowrap" }}>
        Сторінка {page} із {totalPages}
      </span>

      <button onClick={onPrev} disabled={!canPrev}>Назад</button>
      <button onClick={onNext} disabled={!canNext} style={{ marginLeft: 4 }}>Вперед</button>

      <input
        type="text"
        placeholder="Пошук по PDF"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          marginLeft: 16,
          padding: "0.4rem 1rem",
          width: 220,
          minWidth: 160,
          border: "1px solid #e7ebdf",
          borderRadius: "7px",
        }}
      />
      <button onClick={() => runSearch(searchQuery)} style={{ marginLeft: 8 }}>
        Пошук
      </button>

      <button onClick={toggleFullscreen} style={{ marginLeft: 16 }}>
        {isFs ? "Звичайний екран" : "На весь екран"}
      </button>
      <button onClick={handleShare} style={{ marginLeft: 8 }}>
        Поділитись
      </button>
      <a href="#" onClick={() => window.print()} style={{ marginLeft: 8 }}>
        Завантажити
      </a>
    </header>
  );
}
