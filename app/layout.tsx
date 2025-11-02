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

       {/* ===== FOOTER (same grid as header) ===== */}
<footer className="ua-footer">
  <div className="ua-container ua-footer__row">
    <span className="ua-footer__text">
      © {new Date().getFullYear()} — Unison Alberta Online | All Rights Reserved.
    </span>

    {/* backlink label */}
    <a
      href="https://skyronis.com"
      className="ua-footer__link"
      target="_blank"
      rel="noopener"
      aria-label="Visit SKYRON Intelligent Solutions — site developers"
      title="SKYRON Intelligent Solutions — site developers"
    >
      Created by SKYRON Intelligent Solutions.
    </a>
  </div>

  {/* footer styles kept local to layout */}
  <style jsx global>{`
    .ua-footer {
      background: linear-gradient(180deg, var(--ua-deep-2) 0%, var(--ua-deep) 100%);
      border-top: 1px solid rgba(255,255,255,.08);
      color: var(--ua-text-inv);
    }
    .ua-footer__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 0;
    }
    .ua-footer__text { color: var(--ua-text-inv); opacity: .9; }

    /* link looks like the copyright text; underline only on hover */
    .ua-footer__link {
      color: var(--ua-text-inv);
      text-decoration: none;
      font-weight: 500;
      letter-spacing: .01em;
    }
    .ua-footer__link:hover { text-decoration: underline; }
  `}</style>
</footer>
      </body>
    </html>
  );
}
