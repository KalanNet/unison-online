"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** Куди редіректити після успішного логіну; якщо не вказано — читаємо ?next=... або /secure/editor */
  nextUrl?: string;
};

function normalizeNext(raw?: string) {
  const def = "/secure/editor";
  if (!raw) return def;
  // забороняємо зовнішні протоколи та протокольні-агностичні посилання
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return def;
  if (raw.startsWith("//")) return def;
  // має бути внутрішній шлях
  if (!raw.startsWith("/")) return def;
  // не дозволяємо рівно "/" — завжди ведемо в редактор
  if (raw === "/") return def;
  return raw;
}

export default function LoginForm({ nextUrl }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Пропс -> query (?next=) -> дефолт; все через sanitize
  const effectiveNext = useMemo(() => {
    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null;
    return normalizeNext(nextUrl || fromQuery || "/secure/editor");
  }, [nextUrl]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const form = new FormData(e.currentTarget);
      if (!form.get("next")) form.set("next", effectiveNext);

      const res = await fetch("/api/login", { method: "POST", body: form });
      // якщо бекенд повернув HTML (через redirect), не валимо форму:
      let out: any = {};
      try { out = await res.json(); } catch {}

      if (!res.ok) throw new Error(out?.error || "Login failed");

      // пріоритет next від бекенда, але теж санітизуємо
      const fromApi =
        typeof out === "string" ? out : (out && (out.next as string)) || "";
      const target = normalizeNext(fromApi || effectiveNext);

      // Надійно міняємо URL (без історії назад на логін):
      router.replace(target);
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

      {/* Всегда відправляємо next у API */}
      <input type="hidden" name="next" value={effectiveNext} />
    </form>
  );
}
