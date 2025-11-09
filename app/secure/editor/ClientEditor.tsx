"use client";

import React, { useEffect, useState } from "react";
import Viewer from "app/components/Viewer";
import Link from "next/link";

/* ---------- helpers ---------- */
function getSlugFromPublicUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const m = u.pathname.match(/\/directory\/([^\/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    const m = href.match(/\/directory\/([^\/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

type InitMeta = {
  title: string;
  description: string;
  slug: string;
  featuredUrl: string | null;
};
type InitBookmark = { id: string; page: number; label: string; color?: string | null };

export default function ClientEditor({ slug }: { slug?: string }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- initial meta/bookmarks for edit-mode ----
  const [initialMeta, setInitialMeta] = useState<InitMeta | null>(null);
  const [initialBookmarks, setInitialBookmarks] = useState<InitBookmark[]>([]);

  // ---- published links ----
  const [links, setLinks] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Load published list (canonical route)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setListLoading(true);
        const r = await fetch("/api/directory/list-published", { cache: "no-store" });
        const j = await r.json().catch(() => ({ links: [] }));
        if (alive) setLinks(Array.isArray(j?.links) ? j.links : []);
      } catch {
        if (alive) setLinks([]);
      } finally {
        if (alive) setListLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // If opened with ?slug=... → preload meta.json and open Viewer in edit-mode
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/directory/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load");
        if (!alive) return;

        setFileUrl(j?.file || null);
        setInitialMeta({
          title: j?.meta?.title || "",
          description: j?.meta?.description || "",
          slug,
          featuredUrl: j?.meta?.featuredUrl ?? null,
        });
        setInitialBookmarks(Array.isArray(j?.bookmarks) ? j.bookmarks : []);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("pdf", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
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

  // If no file yet → show uploader + published list
  if (!fileUrl) {
    return (
      <div style={{ background: "#21353a", minHeight: "100vh", color: "#fff" }}>
        {/* header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
          <h1 style={{ color: "#f4ce69", fontWeight: 900, fontSize: 28, marginBottom: 32 }}>
            Flipbook Creator/Editor
          </h1>
          <input
            type="file"
            accept="application/pdf"
            disabled={loading}
            style={{
              background: "#fff",
              color: "#222",
              padding: "12px 24px",
              borderRadius: 6,
              fontWeight: 700,
              border: "1px solid #8ea05a",
              width: 340,
              fontSize: 18,
            }}
            onChange={handleUpload}
          />
          <div style={{ marginTop: 22, color: "#bbb", fontSize: 17 }}>
            {loading ? "Loading..." : "Please select a PDF file to begin."}
          </div>
          {error && <div style={{ color: "#e54", marginTop: 20 }}>{error}</div>}
        </div>

        {/* published list */}
        <div style={{ maxWidth: 960, margin: "48px auto 80px", padding: "0 16px" }}>
          <h3 style={{ color: "#f4ce69", fontWeight: 800, margin: "0 0 10px" }}>Published</h3>
          {listLoading && <div style={{ color: "#bbb" }}>Loading…</div>}
          {!listLoading && !links.length && <div style={{ color: "#bbb" }}>No items.</div>}

          {!!links.length && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {links
                .slice()
                .sort((a, b) => a.localeCompare(b))
                .map((href) => {
                  const s = getSlugFromPublicUrl(href);
                  return (
                    <li
                      key={href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        borderTop: "1px dashed rgba(255,255,255,.1)",
                      }}
                    >
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#fff",
                          textDecoration: "none",
                          flex: "1 1 auto",
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={href}
                      >
                        {href}
                      </a>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ua-btn ua-btn--dark"
                        title="Open public"
                      >
                        Go
                      </a>
                      {s ? (
  <Link
    className="ua-btn"
    href={`/secure/editor?slug=${encodeURIComponent(s)}`}
    title="Edit"
  >
    Edit
  </Link>
) : (
  <button className="ua-btn" disabled title="Edit unavailable">
    Edit
  </button>
)}

                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        <style jsx global>{`
          .ua-btn {
            border-radius: 10px;
            padding: 8px 12px;
            font-weight: 700;
            border: 1px solid #cfd8c6;
            background: #fff;
            color: #2d3018;
          }
          .ua-btn[disabled] {
            opacity: 0.55;
            cursor: not-allowed;
          }
          .ua-btn--dark {
            background: #21353a;
            color: #fff;
            border-color: #21353a;
          }
          .ua-btn--dark:hover {
            background: #2a4a56;
            border-color: #2a4a56;
          }
        `}</style>
      </div>
    );
  }

  // In edit-mode or after fresh upload → render Viewer with prefilled meta/bookmarks (if any)
  return <Viewer file={fileUrl} initialMeta={initialMeta || undefined} initialBookmarks={initialBookmarks} />;
}
