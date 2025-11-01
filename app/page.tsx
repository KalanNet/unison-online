// app/page.tsx
export const dynamic = "force-static";

import type { Metadata } from "next";
import Image from "next/image";

import Reveal from "./components/Reveal";
import CountUp from "./components/CountUp";

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
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Unison Alberta" }],
    locale: "en_CA",
    type: "website",
  },
};

const OFFICIAL = "https://unisonalberta.com";
const DONATE = "https://unisonalberta.com/donate";
const CONTACT = "https://unisonalberta.com/contact";
const ABOUT = "https://unisonalberta.com/about";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Unison Alberta",
    url: "https://unisonalberta.online/",
    logo: "https://unisonalberta.com/hubfs/Unison%20Logo.svg",
    sameAs: [OFFICIAL],
    department: [
      { "@type": "Organization", name: "Unison Alberta Directory", url: "https://unisonalberta.online/directory/2025" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main>
        {/* ===== HEADER ===== */}
        <header className="ua-header">
          <div className="ua-container ua-header__in">
            <a href="/" className="ua-header__brand" aria-label="Unison Alberta — Home">
              Unison Alberta
            </a>

            <nav className="ua-header__nav">
              <a href={DONATE} className="ua-btn ua-btn--accent" style={{ color: "#fff" }}>
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
                Empowering seniors 50+ to live their best lives through a series of programs and services.
              </p>

              <div className="ua-hero__cta">
                <a href={OFFICIAL} className="ua-btn ua-btn--dark">
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
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="ua-heroCard__img"
                draggable={false}
              />
              <figcaption className="ua-heroCard__metrics">
                <div className="ua-metric">
                  <div className="ua-metric__num">
                    <CountUp end={790} decimals={0} suffix="+" />
                  </div>
                  <div className="ua-metric__label">Volunteers</div>
                </div>

                <span className="ua-dot" />

                <div className="ua-metric">
                  <div className="ua-metric__num">
                    <CountUp end={1.4} decimals={1} suffix="M" />
                  </div>
                  <div className="ua-metric__label">Total Donations</div>
                </div>

                <span className="ua-dot" />

                <div className="ua-metric">
                  <div className="ua-metric__num">
                    <CountUp end={5.9} decimals={1} suffix="K" />
                  </div>
                  <div className="ua-metric__label">Unison Members</div>
                </div>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ===== DIRECTORY ===== */}
        <section className="dir-wrap">
          <div className="container">
            <Reveal>
              <h2 className="dir-title">Annual Directory</h2>
              <p className="dir-lead">Browse the 2025 directory and preview the 2026 structure.</p>

              <div className="cards-dark">
                <article className="card-dark">
                  <span className="year">2025</span>
                  <div className="ctitle">Unison Directory 2025</div>
                  <p>
                    Alberta Services and Housing.
                  </p>
                  <p style={{ marginTop: 12 }}>
  <a className="link-light" href="https://unison-online-dev.pages.dev/directory/services-and-housing-directory-2025">
    Explore →
  </a>
</p>

                </article>

                <article className="card-dark">
                  <span className="year">2026</span>
                  <div className="ctitle">Directory 2026 (layout ready)</div>
                  <p>
                    Slugs and SEO sections are ready. Content will be added later. URLs will be{" "}
                    <code>/directory/2026/[slug]</code>.
                  </p>
                  <p style={{ marginTop: 12, color: "var(--text-dim)" }}>Coming soon</p>
                </article>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
