// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/* ---------- Fonts ---------- */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/* ---------- Site URLs ---------- */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://unison-online-dev.pages.dev";

/* ---------- Metadata ---------- */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Unison Alberta — Senior Support in Alberta",
    template: "%s · Unison Alberta",
  },
  description:
    "Empowering seniors 50+ to live their best lives through resources, directories and community programs across Alberta.",
  openGraph: {
    title: "Unison Alberta — Senior Support in Alberta",
    description:
      "Empowering seniors 50+ to live their best lives through resources, directories and community programs.",
    url: "https://unisonalberta.online/",
    siteName: "Unison Alberta",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Unison Alberta" }],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Unison Alberta — Senior Support in Alberta",
    description:
      "Empowering seniors 50+ to live their best lives through resources, directories and community programs.",
    images: ["/og.jpg"],
  },
  icons: { icon: "/favicon.ico" },
};

/* ---------- Viewport / theme ---------- */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#111827" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
};

/* ---------- Root Layout ---------- */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const year = new Date().getFullYear();

  return (
    <html lang="en-CA" suppressHydrationWarning>
      <head>
        {/* швидший TLS рукостиск з доменом логотипів/зовнішніх ресурсів */}
        <link rel="preconnect" href="https://unisonalberta.com" crossOrigin="anonymous" />
        {/* Не додаємо ручний preload картинки: Next/Image з `priority` зробить це сам */}
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh flex flex-col`}>
        <main className="flex-1">{children}</main>

        {/* мінімальний футер */}
        <footer
  className="border-t py-3"
  style={{
    background: "linear-gradient(180deg, var(--ua-deep-2) 0%, var(--ua-deep) 100%)",
    borderColor: "rgba(255,255,255,.08)",
    color: "var(--ua-text-inv)",
  }}
>
  <div className="container flex items-center justify-between gap-2">
    <span style={{ color: "var(--ua-text-inv)", opacity: 0.9 }}>
      Copyright © {year} – Unison Alberta Online | All Rights Reserved.
    </span>
    <a
      href="https://skyronis.com"
      className="credit dev-label"
      rel="noopener"
      target="_blank"
      style={{
        color: "var(--ua-text-inv)",
        position: "relative",
        fontWeight: 500,
        textDecoration: "none",
        letterSpacing: "0.01em",
        transition: "all 0.2s",
        paddingLeft: "0.9em"
      }}
      aria-label="Visit developer's website – SKYRON Intelligent Solutions"
    >
      <span style={{
        display: "inline-block",
        marginRight: "0.4em",
        background: "rgba(80,185,255,.13)",
        borderRadius: "4px",
        padding: "0.12em 0.6em",
        fontSize: "0.92em",
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        border: "1px solid rgba(80,185,255,.28)",
        verticalAlign: "middle"
      }}>
        DEV
      </span>
      <span
        style={{
          borderBottom: "1.5px dotted var(--ua-text-inv)",
          transition: "border-bottom 0.2s"
        }}
        className="dev-link-label"
      >
        Created by SKYRON Intelligent Solutions.
      </span>
      <style>
        {`
          .dev-label:hover .dev-link-label {
            border-bottom: 2.5px solid var(--ua-text-inv);
            text-decoration: none;
          }
        `}
      </style>
    </a>
  </div>
</footer>

      </body>
    </html>
  );
}
