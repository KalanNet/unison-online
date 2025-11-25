// app/secure/editor/RightContentEditorPanel.tsx
"use client";

import React from "react";
import type { TocItem } from "./useEditorController";

type Props = {
  autoCollapsed?: boolean; // not used
  items: TocItem[];
  currentPage: number;
  onGotoPage?: (p: number) => void;
  onAddCurrent?: () => void;               // існуючий callback додавання
  onChange?: (id: string, patch: Partial<TocItem>) => void;
  onRemove?: (id: string) => void;
  onSave?: () => Promise<void>;
  canSave?: boolean;
};

export default function RightContentEditorPanel({
  autoCollapsed: _,
  items,
  currentPage,
  onGotoPage,
  onAddCurrent,
  onChange,
  onRemove,
  onSave,
  canSave = true,
}: Props) {
  const [saving, setSaving] = React.useState(false);

  /* ───────────────────── 0) Helpers ───────────────────── */
  const isInvalid = (it: TocItem) => {
    const nameEmpty = !String(it.label ?? "").trim();
    const pageNum = Number((it as any).page);
    const pageEmpty = !Number.isFinite(pageNum) || pageNum <= 0;
    return nameEmpty || pageEmpty;
  };

  /* ───────────────────── 1) ДВОРІВНЕВЕ СОРТУВАННЯ ───────────────────── */
  const sorted = React.useMemo(() => {
    const normPage = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
    };
    const normLabel = (s: any) => String(s ?? "").trim();
    return [...items].sort((a, b) => {
      const pa = normPage(a.page as any);
      const pb = normPage(b.page as any);
      if (pa !== pb) return pa - pb;
      const la = normLabel(a.label);
      const lb = normLabel(b.label);
      return la.localeCompare(lb, undefined, { sensitivity: "base" });
    });
  }, [items]);

  /* ─────────────── 2) FLIP-анімація при зміні порядку ─────────────── */
  const itemRefs = React.useRef(new Map<string, HTMLDivElement>());
  const prevRects = React.useRef(new Map<string, DOMRect>());

  const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  };

  React.useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    sorted.forEach((it) => {
      const el = itemRefs.current.get(it.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      nextRects.set(it.id, rect);

      const prev = prevRects.current.get(it.id);
      if (!prev) return;

      const dy = prev.top - rect.top;
      if (dy !== 0) {
        el.style.transform = `translateY(${dy}px)`;
        el.style.transition = "transform 0s";
        requestAnimationFrame(() => {
          el.style.transition = "transform 240ms cubic-bezier(.22,.61,.36,1)";
          el.style.transform = "translateY(0)";
        });
      }
    });
    prevRects.current = nextRects;
  }, [sorted]);

  /* ───────────── 3) Пастка клавіш всередині панелі (щоб пробіл працював) ───────────── */
  const trapKeysInsidePanel = React.useCallback((e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    const isEditable =
      !!el &&
      (el.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        !!el.closest(
          'input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]'
        ));

    if (!isEditable) return;

    const k = e.key;
    if (
      k === " " ||
      k === "Space" ||
      k === "Spacebar" ||
      k.startsWith("Arrow") ||
      k === "Home" ||
      k === "End" ||
      k === "PageUp" ||
      k === "PageDown" ||
      k === "Enter" ||
      k === "Tab"
    ) {
      e.stopPropagation();
      // @ts-ignore
      e.nativeEvent?.stopImmediatePropagation?.();
    }
  }, []);

  /* ───────────── 4) Додавання “порожнього” елемента поверх існуючого onAddCurrent ─────────────
     Батьківський onAddCurrent додає item із дефолтами (Page N, page N).
     Ми перехоплюємо факт додавання, знаходимо новий id і відразу очищаємо label та page.
  */
  const pendingAddIdsSnapshot = React.useRef<Set<string> | null>(null);
  const pendingAdd = React.useRef(false);
  const titleInputRefs = React.useRef(new Map<string, HTMLInputElement>());

  const handleAddEmpty = React.useCallback(() => {
    if (!onAddCurrent) return;
    // знімаємо “зріз” поточних id, щоб потім знайти нові
    pendingAddIdsSnapshot.current = new Set(items.map((i) => i.id));
    pendingAdd.current = true;
    onAddCurrent();
  }, [items, onAddCurrent]);

  React.useEffect(() => {
    if (!pendingAdd.current || !pendingAddIdsSnapshot.current) return;
    const prev = pendingAddIdsSnapshot.current;

    const newlyAdded = items.filter((it) => !prev.has(it.id));
    if (newlyAdded.length === 0) return;

    // очищаємо всі нові (на випадок швидких кількох кліків)
    newlyAdded.forEach((it) => {
      onChange?.(it.id, { label: "", page: undefined as any });
      // сфокусуємо назву — зручно одразу вводити
      const input = titleInputRefs.current.get(it.id);
      if (input) {
        try {
          input.focus();
        } catch {}
      }
    });

    pendingAdd.current = false;
    pendingAddIdsSnapshot.current = null;
  }, [items, onChange]);

  /* ───────────────────── 5) Збереження ───────────────────── */
  async function handleSave() {
    if (!onSave || !canSave) return;
    try {
      setSaving(true);
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside
      className="rce"
      aria-label="Content editor"
      onKeyDownCapture={trapKeysInsidePanel}
    >
      <div className="rce-inner">
        <div className="rce-header">
          <div className="rce-title">TABLE of CONTENTS</div>
          <div className="rce-actions">
            <button
              className="rce-btn"
              title={`Add item (current page: ${currentPage})`}
              onClick={handleAddEmpty}
            >
              <span className="plus" aria-hidden>
                +
              </span>
              Add
            </button>
            <button
              className="rce-btn primary"
              disabled={!canSave || saving}
              title={
                canSave ? "Save content.json" : "Publish meta first to get a slug"
              }
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="rce-list" role="list">
          {sorted.length === 0 && (
            <div className="rce-empty">No items yet — press “+ Add”.</div>
          )}

          {sorted.map((it) => {
            const pageStr =
              (it as any).page === undefined || (it as any).page === null
                ? ""
                : String(it.page);
            const invalid = isInvalid(it);

            return (
              <div
                key={it.id}
                role="listitem"
                className="rce-item"
                data-invalid={invalid ? "true" : "false"}
                ref={setItemRef(it.id)}
                aria-invalid={invalid || undefined}
              >
                {/* Назва */}
                <input
                  className="rce-inp rce-inp-title"
                  type="text"
                  value={it.label}
                  placeholder="Type section title…"
                  onChange={(e) =>
                    onChange?.(it.id, { label: e.target.value })
                  }
                  onKeyDownCapture={trapKeysInsidePanel}
                  autoComplete="off"
                  spellCheck={false}
                  id={`toc-title-${it.id}`}
                  aria-label="Section title"
                  ref={(el) => {
                    if (el) titleInputRefs.current.set(it.id, el);
                    else titleInputRefs.current.delete(it.id);
                  }}
                />

                {/* Другий рядок */}
                <div className="rce-row">
                  <label className="rce-chk">
                    <input
                      type="checkbox"
                      checked={!!it.isSection}
                      onChange={(e) =>
                        onChange?.(it.id, { isSection: e.target.checked })
                      }
                    />
                    Section
                  </label>

                  <div className="rce-page">
                    <span className="rce-sublab">Page</span>
                    <input
                      className="rce-inp rce-inp-num"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pageStr}
                      placeholder="—"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw.trim() === "") {
                          onChange?.(it.id, { page: undefined as any });
                        } else {
                          onChange?.(it.id, { page: Number(raw) as any });
                        }
                      }}
                      aria-label="Page number"
                    />
                    <button
                      className="rce-mini"
                      title={`Go to p.${pageStr || "?"}`}
                      onClick={() => {
                        const n = Number(pageStr);
                        if (Number.isFinite(n) && n > 0) onGotoPage?.(n);
                      }}
                    >
                      Go
                    </button>
                  </div>

                  <button
                    className="rce-mini danger"
                    title="Delete"
                    onClick={() => onRemove?.(it.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .rce {
          position: fixed;
          right: 0;
          top: var(--hdr, 56px);
          bottom: var(--ftr, 64px);
          width: 420px;
          background: linear-gradient(180deg, #23272f, #171a20);
          padding: 16px;
          z-index: 1050;
          box-shadow: -4px 0 18px rgba(0, 0, 0, 0.32);
          overflow: hidden;
        }
        .rce-inner {
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: auto;
        }

        .rce-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 2px 2px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .rce-title {
          color: #e9f0e4;
          font-weight: 900;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          opacity: 0.92;
        }
        .rce-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .rce-btn {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: #2a2f38;
          color: #fff;
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 800;
        }
        .rce-btn.primary {
          background: #0f7f4f;
          border-color: #0f7f4f;
        }
        .rce-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .plus {
          display: inline-block;
          font-weight: 900;
          margin-right: 8px;
        }

        .rce-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 2px;
        }
        .rce-empty {
          color: #b9c2cf;
          opacity: 0.9;
          padding: 6px 2px;
        }

        .rce-item {
          display: grid;
          grid-template-rows: auto auto;
          gap: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 12px;
          will-change: transform;
        }

        .rce-inp {
          width: 100%;
          background: #1e232b;
          color: #e8ecf2;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
        }
        .rce-inp::placeholder {
          color: #8f98a6;
          opacity: 0.8;
        }
        .rce-inp-title {
          font-weight: 800;
          letter-spacing: 0.2px;
        }

        .rce-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 10px;
        }

        .rce-chk {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #bdc6d3;
          font-size: 14px;
          user-select: none;
        }

        .rce-page {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .rce-sublab {
          color: #bdc6d3;
          font-size: 13px;
        }
        .rce-inp-num {
          width: 90px;
          text-align: center;
          font-weight: 800;
        }

        .rce-mini {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: #1e232b;
          color: #e8ecf2;
          border-radius: 10px;
          padding: 8px 12px;
          font-weight: 800;
        }
        .rce-mini.danger {
          border-color: #b43f3f;
          background: #7a2d2d;
        }

        /* Підсвітка незаповнених елементів */
        .rce-item[data-invalid="true"] {
          border-color: #c85151;
          box-shadow: 0 0 0 2px rgba(200, 81, 81, 0.25);
          animation: rcePulse 1150ms ease-in-out infinite;
        }
        @keyframes rcePulse {
          0% { box-shadow: 0 0 0 0 rgba(200,81,81,.22); }
          50% { box-shadow: 0 0 0 4px rgba(200,81,81,.10); }
          100% { box-shadow: 0 0 0 0 rgba(200,81,81,.22); }
        }

        @media (prefers-reduced-motion: reduce) {
          .rce,
          .rce-item {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </aside>
  );
}
