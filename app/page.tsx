// app/page.tsx
export const dynamic = "force-static";

import type { Metadata } from "next";
import Image from "next/image";
import CountUp from "./components/CountUp";

const OFFICIAL = "https://unisonalberta.com";
const DONATE = "https://unisonalberta.com/donate";

// featured/OG картинка для головної (лежить у public/og-featured-home.jpg)
const HOME_OG = "/og-featured-home.jpg";

export const metadata: Metadata = {
  title: "Unison Alberta — Senior Support in Alberta",
  description:
    "Empowering seniors 50+ to live their best lives through resources, directories and community programs across Alberta.",
  openGraph: {
    title: "Unison Alberta — Senior Support in Alberta",
    description:
      "Empowering seniors 50+ to live their best lives through resources, directories and community programs.",
    url: "https://unisonalberta.online/",
    siteName: "Unison Alberta",
    images: [
      {
        url: HOME_OG,
        width: 1200,
        height: 630,
        alt: "Unison Alberta — Senior Support in Alberta",
      },
    ],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Unison Alberta — Senior Support in Alberta",
    description:
      "Empowering seniors 50+ to live their best lives through resources, directories and community programs.",
    images: [HOME_OG],
  },
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Unison Alberta",
    url: "https://unisonalberta.online/",
    logo: "https://unison-online-dev.pages.dev/unison-logo.svg",
    sameAs: [OFFICIAL],
    department: [
      {
        "@type": "Organization",
        name: "Unison Alberta Directory",
        url: "https://unisonalberta.online/unison-directory/services-and-housing",
      },
    ],
  };

  // Розрахунок року: поточна дата + 5 днів
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 5);
  const displayYear = targetDate.getFullYear();

  return (
    <>
      <script
        type="application/ld+json"
        // SEO: структуровані дані
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* ===== HEADER ===== */}
        <header className="ua-header">
          <div className="ua-container ua-header__in">
            <a
              href="/"
              className="ua-header__brand scale-90 sm:scale-100 origin-left"
              aria-label="Unison Alberta — Home"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/unison-logo.svg"
                alt="Unison Alberta"
                className="ua-header__logo"
              />
            </a>

            <nav className="ua-header__nav scale-90 sm:scale-100 origin-right">
              <a
                href={DONATE}
                className="ua-btn ua-btn--accent"
                style={{ color: "#fff" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                Donate now
              </a>
            </nav>
          </div>
        </header>

        {/* ===== HERO ===== */}
        <section className="ua-hero">
          <div className="ua-hero__container ua-hero__grid">
            <div className="ua-hero__left">
              <h1 className="ua-hero__title">
                Senior Support
                <br />
                in Alberta
              </h1>

              <p className="ua-hero__lead">
                Empowering seniors 50+ to live their best lives through a
                series of programs and services.
              </p>

              <div className="ua-hero__cta">
                <a
                  href={OFFICIAL}
                  className="ua-btn ua-btn--dark"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official Website →
                </a>
              </div>
            </div>

            <figure className="ua-heroCard" aria-label="Community highlight">
              {/* LCP image with priority + responsive sizes */}
              <Image
                src="/hero-portrait.webp"
                alt=""
                width={1200}
                height={630}
                priority
                sizes="(max-width: 1100px) 100vw, (max-width: 1560px) 44vw, 880px"
                className="ua-heroCard__img"
                draggable={false}
              />

              <figcaption className="ua-heroCard__metrics">
                {/* 5.9K Members */}
                <div className="ua-metric">
                  <div className="ua-metric__num">
                    <CountUp end={5.9} decimals={1} suffix="K" />
                  </div>
                  <div className="ua-metric__label">Members</div>
                </div>

                {/* 50+ Years / Years of Serving Seniors */}
                <div className="ua-metric">
                  <div className="ua-metric__num">
                    <CountUp end={50} decimals={0} suffix="+" />
                  </div>
                  <div className="ua-metric__label">
                    <span className="sm:hidden">Years</span>
                    <span className="hidden sm:inline">
                      Years of Serving Seniors
                    </span>
                  </div>
                </div>

                {/* 55K Clients / Clients in 2024 */}
                <div className="ua-metric">
                  <div className="ua-metric__num">
                    <CountUp end={55} decimals={0} suffix="K" />
                  </div>
                  <div className="ua-metric__label">
                    <span className="sm:hidden">Clients</span>
                    <span className="hidden sm:inline">Clients in 2024</span>
                  </div>
                </div>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ===== DIRECTORY (Merged Single Card) ===== */}
        <section className="dir-wrap">
          <div className="container">
            <h2 className="dir-title">Unison Annual Directory</h2>
            <p className="dir-lead">
              The Unison Directory is updated annually to provide valuable
              information to older adults, family members, support workers or
              referral agencies about housing and relevant services within
              Southern Alberta.
            </p>

            {/* Використовуємо один блок для test суцільного шейпа */}
            <div className="cards-dark" style={{ display: "block" }}>
              <a
                href="https://unisonalberta.online/unison-directory/services-and-housing"
                target="_blank"
                rel="noopener noreferrer"
                className="card-dark"
                style={{
                  display: "block",
                  width: "100%",
                  textDecoration: "none",
                }}
              >
                <span className="year">{displayYear}</span>
                <div className="ctitle">
                  Services &amp; Housing Directory
                </div>
                <p>
                  Access housing and service information through 
                  our easy-to-navigate interactive directory catalogue –
                  a comprehensive resource designed with seniors in mind.
                </p>
                <p style={{ marginTop: 12 }}>
                  <span className="link-light">Explore →</span>
                </p>
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}