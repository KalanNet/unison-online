// app/secure/editor/RightContentEditorPanel.tsx
"use client";

import React from "react";
import type { TocItem } from "./useEditorController";

type Props = {
  autoCollapsed?: boolean;
  items: TocItem[];
  currentPage: number;
  onGotoPage?: (p: number) => void;
  onAddCurrent?: () => void;
  onChange?: (id: string, patch: Partial<TocItem>) => void;
  onRemove?: (id: string) => void;
  onSave?: () => Promise<void>;
  canSave?: boolean;
};

export default function RightContentEditorPanel({
  autoCollapsed,
  items,
  currentPage,
  onGotoPage,
  onAddCurrent,
  onChange,
  onRemove,
  onSave,
  canSave = true,
}: Props) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof autoCollapsed === "boolean") setCollapsed(autoCollapsed);
  }, [autoCollapsed]);

  async function handleSave() {
    if (!onSave || !canSave) return;
    try { setSaving(true); await onSave(); }
    finally { setSaving(false); }
  }

  return (
    <aside className={`rce ${collapsed ? "is-collapsed" : ""}`} aria-label="Content editor">
      <button
        type="button"
        className="rce-toggle"
        aria-label={collapsed ? "Expand contents" : "Collapse contents"}
        title={collapsed ? "Show contents" : "Hide contents"}
        onClick={() => setCollapsed(v => !v)}
      />

      <div className="rce-inner" ref={listRef}>
        <div className="rce-header">
          <div className="rce-title">CONTENT&nbsp;TABLE</div>
          <div className="rce-actions">
            <button
              className="rce-btn"
              title={`Add item for p.${currentPage}`}
              onClick={onAddCurrent}
            >
              <span className="plus" aria-hidden>+</span> Add current
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
            <div className="rce-empty">No items yet — add current page.</div>
          )}

          {items.map((it) => (
            <div key={it.id} role="listitem" className="rce-item">
              <div className="rce-col dot">
                <span className={`rce-dot ${it.isSection ? "sec" : ""}`} aria-hidden />
              </div>

              <div className="rce-col label">
                <input
                  className="rce-inp"
                  value={it.label}
                  placeholder="Label"
                  onChange={(e) => onChange?.(it.id, { label: e.target.value })}
                />
                <label className="rce-chk">
                  <input
                    type="checkbox"
                    checked={!!it.isSection}
                    onChange={(e) => onChange?.(it.id, { isSection: e.target.checked })}
                  />
                  Section
                </label>
              </div>

              <div className="rce-col page">
                <input
                  className="rce-inp rce-inp-num"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(it.page)}
                  onChange={(e) => onChange?.(it.id, { page: Number(e.target.value || 1) })}
                />
                <button className="rce-mini" title="Go" onClick={() => onGotoPage?.(it.page)}>Go</button>
              </div>

              <div className="rce-col del">
                <button className="rce-mini danger" title="Remove" onClick={() => onRemove?.(it.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .rce{position:fixed;right:0;top:var(--hdr,56px);bottom:var(--ftr,64px);width:380px;background:linear-gradient(180deg,#23272f,#171a20);padding:14px;z-index:1050;box-shadow:-4px 0 18px rgba(0,0,0,.32);transition:transform .35s ease;overflow:hidden}
        .rce.is-collapsed{transform:translateX(100%)}
        .rce-toggle{position:absolute;top:50%;left:-20px;transform:translateY(-50%);width:30px;height:80px;border:0;border-radius:12px 0 0 12px;background:rgba(0,0,0,.35);box-shadow:-4px 0 10px rgba(0,0,0,.4);cursor:pointer}
        .rce-toggle::before{content:"";display:block;width:18px;height:18px;border-right:3px solid rgba(255,255,255,.9);border-top:3px solid rgba(255,255,255,.9);transform:rotate(45deg)}
        .rce.is-collapsed .rce-toggle::before{transform:rotate(-135deg)}
        .rce-inner{height:100%;display:flex;flex-direction:column;gap:10px;overflow:auto}
        .rce-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 8px;border-bottom:1px solid rgba(255,255,255,.08)}
        .rce-title{color:#e9f0e4;font-weight:800;letter-spacing:.02em;text-transform:uppercase;opacity:.9}
        .rce-actions{display:flex;gap:8px;flex-wrap:wrap}
        .rce-btn{border:1px solid rgba(255,255,255,.12);background:#2a2f38;color:#fff;padding:8px 10px;border-radius:10px;font-weight:700}
        .rce-btn.primary{background:#0f7f4f;border-color:#0f7f4f}
        .rce-btn:disabled{opacity:.55;cursor:not-allowed}
        .plus{display:inline-block;font-weight:900;margin-right:6px}
        .rce-list{display:flex;flex-direction:column;gap:8px;padding-right:2px}
        .rce-empty{color:#b9c2cf;opacity:.9;padding:4px 2px}
        .rce-item{display:grid;grid-template-columns:16px 1fr auto auto;gap:8px;align-items:center;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:10px}
        .rce-dot{width:10px;height:10px;border-radius:50%;background:#9aa4b2}
        .rce-dot.sec{background:#f4ce69;box-shadow:0 0 0 2px rgba(244,206,105,.18)}
        .rce-inp{width:100%;background:#1e232b;color:#e8ecf2;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 8px}
        .rce-inp-num{width:80px;text-align:center}
        .rce-chk{display:inline-flex;align-items:center;gap:6px;color:#bdc6d3;font-size:13px;margin-top:6px}
        .rce-mini{border:1px solid rgba(255,255,255,.14);background:#1e232b;color:#e8ecf2;border-radius:8px;padding:6px 10px;font-weight:700}
        .rce-mini.danger{border-color:#b43f3f;background:#732828}
        @media (prefers-reduced-motion: reduce){
          .rce{transition:none}
        }
      `}</style>
    </aside>
  );
}
