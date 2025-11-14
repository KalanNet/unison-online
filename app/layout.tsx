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

/* ---------- Default OG image ---------- */
const OG_DEFAULT = "/og-featured-home.jpg";

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
    images: [{ url: OG_DEFAULT, width: 1200, height: 630, alt: "Unison Alberta" }],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Unison Alberta — Senior Support in Alberta",
    description:
      "Empowering seniors 50+ to live their best lives through resources, directories and community programs.",
    images: [OG_DEFAULT],
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
        <link
          rel="preconnect"
          href="https://unisonalberta.com"
          crossOrigin="anonymous"
        />
        {/* Не додаємо ручний preload картинки: Next/Image з `priority` зробить це сам */}
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh flex flex-col`}
      >
        <main className="flex-1">{children}</main>
        {/* мінімальний футер (server-friendly) */}
        {/* ===== FOOTER (desktop unchanged; wraps & centers on narrow) ===== */}
        <footer
          className="border-t py-3"
          style={{
            background:
              "linear-gradient(180deg, var(--ua-deep-2) 0%, var(--ua-deep) 100%)",
            borderColor: "rgba(255,255,255,.08)",
            color: "var(--ua-text-inv)",
          }}
        >
          <div className="ua-container flex flex-wrap items-center justify-between gap-2">
            {/* Ліва секція: 2 рядки (на вузьких центрується) */}
            <div
              className="basis-full sm:basis-auto text-center sm:text-left"
              style={{ opacity: 0.9 }}
            >
              <span className="block sm:inline">
                Copyright © {year} – Unison Alberta Online.
              </span>
              <span className="block sm:inline sm:ml-1">
                All Rights Reserved.
              </span>
            </div>

            {/* Права секція: на вузьких переходить на новий рядок і центрується */}
            <div className="basis-full sm:basis-auto text-center sm:text-right">
              <a
                href="https://skyronis.com"
                className="hover:underline"
                rel="noopener noreferrer"
                target="_blank"
                aria-label="Visit SKYRON Intelligent Solutions — IT consulting, development, and automation"
                title="SKYRON Intelligent Solutions — IT consulting, development, and automation"
              >
                Created by SKYRON Intelligent Solutions
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
