"use client";

import { useMemo, useState } from "react";

type Props = {
  /** Куди редіректити після успішного логіну; якщо не вказано — читаємо ?next=... або /secure/editor */
  nextUrl?: string;
};

export default function LoginForm({ nextUrl }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Обчислюємо надійний next: пропс -> query (?next=) -> дефолт
  const effectiveNext = useMemo(() => {
    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null;
    return nextUrl || fromQuery || "/secure/editor";
  }, [nextUrl]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const form = new FormData(e.currentTarget);
      // гарантуємо, що next завжди є у payload
      if (!form.get("next")) form.set("next", effectiveNext);

      const res = await fetch("/api/login", { method: "POST", body: form });
      const out = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(out?.error || "Login failed");

      // пріоритет: те, що повернув бекенд -> effectiveNext
      const redirectTo =
        (out && (out.next as string)) ||
        (typeof out === "string" ? out : "") ||
        effectiveNext;

      if (typeof window !== "undefined") {
        window.location.href = redirectTo;
      }
    } catch (ex: any) {
      setErr(String(ex?.message || ex) || "Login error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-semibold">Secure Access</h1>

      <input
        name="user"
        placeholder="User"
        className="w-full border px-3 py-2 rounded"
        required
        autoComplete="username"
      />

      <input
        name="pass"
        type="password"
        placeholder="Password"
        className="w-full border px-3 py-2 rounded"
        required
        autoComplete="current-password"
      />

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <button disabled={loading} className="w-full rounded bg-black text-white py-2">
        {loading ? "Signing in..." : "Sign in"}
      </button>

      {/* Передаємо next до API та тримаємо fallback на /secure/editor */}
      <input type="hidden" name="next" value={effectiveNext} />
    </form>
  );
}
