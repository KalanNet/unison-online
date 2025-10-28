// app/(login)/ClientLoginForm.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";

/** Пропси, які очікує форма логіну */
export type LoginFormProps = {
  nextUrl: string;
};

/** Динамічне підвантаження компонента з еліасом '@/components/…' */
const LoginForm = dynamic(() => import("app/components/LoginForm"), { ssr: false });


export default function ClientLoginForm(props: LoginFormProps) {
  return <LoginForm {...props} />;
}
