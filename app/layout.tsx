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
  // ---- FAVICONS
  icons: {
    icon: [
      { url: "/favicon-16x16.png?v=3", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico?v=3" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico?v=3"],
  },
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
        <link
          rel="preconnect"
          href="https://unisonalberta.com"
          crossOrigin="anonymous"
        />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh flex flex-col`}
      >
        <main className="flex-1">{children}</main>
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
