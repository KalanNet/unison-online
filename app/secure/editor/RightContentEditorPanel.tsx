"use client";

import React from "react";
import type { TocItem } from "./useEditorController";

type Props = {
  /** Залишено для сумісності з існуючим викликом у Viewer.tsx (не використовується) */
  autoCollapsed?: boolean;
  items: TocItem[];
  currentPage: number;
  onGotoPage?: (p: number) => void;
  onAddCurrent?: () => void; // використовується як “+ Add”
  onChange?: (id: string, patch: Partial<TocItem>) => void;
  onRemove?: (id: string) => void;
  onSave?: () => Promise<void>;
  canSave?: boolean;
};

export default function RightContentEditorPanel({
  autoCollapsed, // eslint-disable-line @typescript-eslint/no-unused-vars
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

  // === ВАЖЛИВО ===
  // Перехоплюємо натискання клавіш усередині панелі на capture-фазі
  // і блокуємо подальше спливання (щоб глобальні шорткати не заважали набирати текст).
  const trapKeysInsidePanel = React.useCallback((e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    const isEditable =
      !!el &&
      (el.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        !!el.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]'));

    if (!isEditable) return;

    const k = e.key;
    // даємо працювати дефолту (вставка пробілу тощо),
    // але зупиняємо *спливання*, щоб не спрацювали глобальні обробники
    if (
      k === " " || k === "Space" || k === "Spacebar" ||
      k.startsWith("Arrow") ||
      k === "Home" || k === "End" ||
      k === "PageUp" || k === "PageDown" ||
      k === "Enter" || k === "Tab"
    ) {
      e.stopPropagation();
      // @ts-ignore – nativeEvent існує у React SyntheticEvent
      e.nativeEvent?.stopImmediatePropagation?.();
    }
  }, []);

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
      // <-- КЛЮЧОВЕ: перехоплюємо клавіші ще до глобальних слухачів
      onKeyDownCapture={trapKeysInsidePanel}
    >
      <div className="rce-inner">
        <div className="rce-header">
          <div className="rce-title">CONTENT TABLE</div>
          <div className="rce-actions">
            <button
              className="rce-btn"
              title={`Add item (current page: ${currentPage})`}
              onClick={onAddCurrent}
            >
              <span className="plus" aria-hidden>
                +
              </span>
              Add
            </button>
            <button
              className="rce-btn primary"
              disabled={!canSave || saving}
              title={canSave ? "Save content.json" : "Publish meta first to get a slug"}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="rce-list" role="list">
          {items.length === 0 && (
            <div className="rce-empty">No items yet — press “+ Add”.</div>
          )}

          {items.map((it) => (
            <div key={it.id} role="listitem" className="rce-item">
              {/* Назва — на всю ширину; пробіли тепер НЕ перехоплює глобальний keydown */}
              <input
                className="rce-inp rce-inp-title"
                type="text"
                value={it.label}
                placeholder="Type section title…"
                onChange={(e) => onChange?.(it.id, { label: e.target.value })}
                onKeyDownCapture={trapKeysInsidePanel}  // дублюємо на всяк випадок
                autoComplete="off"
                spellCheck={false}
                id={`toc-title-${it.id}`}
                aria-label="Section title"
              />

              {/* Другий рядок: чекбокс Section, сторінка, Go, Delete */}
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
                    value={String(it.page)}
                    onChange={(e) =>
                      onChange?.(it.id, { page: Number(e.target.value || 1) })
                    }
                    aria-label="Page number"
                  />
                  <button
                    className="rce-mini"
                    title={`Go to p.${it.page}`}
                    onClick={() => onGotoPage?.(it.page)}
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
          ))}
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

        @media (prefers-reduced-motion: reduce) {
          .rce,
          .rce-item {
            transition: none;
          }
        }
      `}</style>
    </aside>
  );
}
