"use client";

import LoginForm from "../components/LoginForm";

export type LoginFormProps = {
  /** Куди редіректити після успішного логіну; за замовчуванням -> /secure/editor */
  nextUrl?: string;
};

export default function ClientLoginForm(props: LoginFormProps) {
  // гарантуємо дефолт на /secure/editor, навіть якщо пропсів немає
  const effectiveNext = props.nextUrl ?? "/secure/editor";
  return <LoginForm nextUrl={effectiveNext} />;
}
