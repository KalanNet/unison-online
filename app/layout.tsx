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
// Укажи домен у .env: NEXT_PUBLIC_SITE_URL=https://unison-online-dev.pages.dev
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
  icons: {
    icon: "/favicon.ico",
  },
};

/* ---------- Viewport / theme ---------- */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#111827" }, // zinc-900
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
        {/* Speed up first connection to external assets (logo, etc.) */}
        <link rel="preconnect" href="https://unisonalberta.com" crossOrigin="" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh flex flex-col`}>
        <main className="flex-1">{children}</main>

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
              © {year} Unison Alberta — All rights reserved.
            </span>
            <a
              href="https://skyronis.com"
              className="credit"
              rel="noopener"
              target="_blank"
              style={{ color: "var(--ua-text-inv)" }}
            >
              Built by <strong>Skyron Intelligent Solutions</strong>.
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}

