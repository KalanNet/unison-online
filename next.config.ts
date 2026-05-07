import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FINANCIAL_STATEMENTS_FILE = "unison-society-financial-statements.pdf";

function getFinancialStatementsVersion() {
  try {
    const pdf = readFileSync(join(process.cwd(), "public", FINANCIAL_STATEMENTS_FILE));
    return createHash("sha256").update(pdf).digest("hex").slice(0, 12);
  } catch {
    return "latest";
  }
}

const FINANCIAL_STATEMENTS_VERSION = getFinancialStatementsVersion();
const FINANCIAL_STATEMENTS_PDF = `/${FINANCIAL_STATEMENTS_FILE}?v=${FINANCIAL_STATEMENTS_VERSION}`;

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
