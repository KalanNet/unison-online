"use client";

import { useState } from "react";

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      // якщо в урлі немає ?next=..., дефолт -> /secure/editor
      if (!fd.get("next")) fd.set("next", "/secure/editor");

      const res = await fetch("/api/login", { method: "POST", body: fd });
      const out = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(out?.error || "Login failed");

      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(location.search);
        const nextUrl =
          out?.next || sp.get("next") || "/secure/editor"; // <- головна зміна
        window.location.href = nextUrl;
      }
    } catch (ex: any) {
      setErr(String(ex?.message || ex));
    } finally {
      setLoading(false);
    }
  }

  // UI форми — без змін, окрім прихованого next із дефолтом
  return (
    <form className="login-form" method="post" action="/api/login" onSubmit={onSubmit}>
      <input
        type="hidden"
        name="next"
        value={
          typeof window !== "undefined"
            ? new URLSearchParams(location.search).get("next") || "/secure/editor"
            : "/secure/editor"
        }
      />

      <label className="lf-field">
        <span className="lf-lab">Username</span>
        <input className="lf-inp" name="user" autoComplete="username" required />
      </label>

      <label className="lf-field">
        <span className="lf-lab">Password</span>
        <input
          className="lf-inp"
          name="pass"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      {err && <div className="lf-err">{err}</div>}

      <button className="lf-btn" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
