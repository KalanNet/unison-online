// app/secure/editor/ClientEditor.tsx
"use client";

import { useState } from "react";

type PublishResponse = { ok?: boolean; urlPath?: string; error?: string };

export default function ClientEditor() {
  const [pdfUrl, setPdfUrl] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PublishResponse | null>(null);

  async function onPublish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pdfUrl, title, slug, description }),
      });

      const data = (await res.json()) as PublishResponse;
      setResult(data);
    } catch (err) {
      setResult({ error: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  const previewHref =
    pdfUrl ? `/viewer?file=${encodeURIComponent(pdfUrl)}&title=${encodeURIComponent(title || "Preview")}` : "";

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Flipbook Editor</h1>

      <form onSubmit={onPublish} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">PDF URL *</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="https://.../source.pdf"
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
            required
            inputMode="url"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Тимчасово використовуємо вже доступний URL PDF (без аплоаду). Пізніше можна підключити R2.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Directory 2025 — Health Services"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Slug *</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="health-services"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              pattern="^[a-z0-9-]+$"
              title="Тільки a-z, 0-9, дефіс"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Meta description</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={3}
            placeholder="Short SEO description for the published page"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex gap-3 items-center">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
          >
            {submitting ? "Publishing..." : "Publish"}
          </button>

          {pdfUrl && (
            <a
              href={previewHref}
              target="_blank"
              rel="noopener"
              className="rounded border px-4 py-2"
            >
              Preview in Viewer
            </a>
          )}
        </div>
      </form>

      {result && (
        <div className="rounded border p-4 bg-neutral-50">
          {result.error ? (
            <p className="text-red-600">Error: {result.error}</p>
          ) : result.ok ? (
            <div className="space-y-2">
              <p className="text-green-700 font-medium">Published successfully.</p>
              {result.urlPath && (
                <p>
                  URL:&nbsp;
                  <a className="text-blue-700 underline" href={result.urlPath} target="_blank" rel="noopener">
                    {result.urlPath}
                  </a>
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
