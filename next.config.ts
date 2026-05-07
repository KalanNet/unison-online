import type { NextConfig } from "next";

const FINANCIAL_STATEMENTS_VERSION = "2025-05-07";
const FINANCIAL_STATEMENTS_PDF = `/unison-society-financial-statements.pdf?v=${FINANCIAL_STATEMENTS_VERSION}`;

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/unison-society-financial-statements",
        destination: FINANCIAL_STATEMENTS_PDF,
        permanent: false,
      },
      {
        source: "/unison-society-financial-statements/",
        destination: FINANCIAL_STATEMENTS_PDF,
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/unison-society-financial-statements.pdf",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, max-age=0, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
