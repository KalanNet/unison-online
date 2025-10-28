"use client";

import { useState } from "react";

export default function LoginForm({ nextUrl }: { nextUrl: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/login", {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      window.location.href = nextUrl || "/";
    } else {
      const { error } = await res.json().catch(() => ({ error: "Auth failed" }));
      setErr(error || "Auth failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-semibold">Secure Access</h1>
      <input name="user" placeholder="User" className="w-full border px-3 py-2 rounded" required />
      <input name="pass" type="password" placeholder="Password" className="w-full border px-3 py-2 rounded" required />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <button disabled={loading} className="w-full rounded bg-black text-white py-2">
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <input type="hidden" name="next" value={nextUrl} />
    </form>
  );
}
