// app/(login)/ClientLoginForm.tsx
"use client";

import LoginForm from "../components/LoginForm";

export type LoginFormProps = {
  /** Куди редіректити після успішного логіну; дефолт -> /secure/editor */
  nextUrl?: string;
};

function normalizeNext(raw?: string) {
  const def = "/secure/editor";
  if (!raw) return def;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return def;
  if (raw.startsWith("//")) return def;
  if (!raw.startsWith("/")) return def;
  if (raw === "/") return def;
  return raw;
}

export default function ClientLoginForm(props: LoginFormProps) {
  // навіть якщо зверху випадково прокинуть "/", тут підмінемо на /secure/editor
  const effectiveNext = normalizeNext(props.nextUrl);
  return <LoginForm nextUrl={effectiveNext} />;
}
