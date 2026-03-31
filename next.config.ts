import type { NextConfig } from "next";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const FINANCIAL_STATEMENTS_DIR = join(
  process.cwd(),
  "public",
  "documents",
  "unison-society-financial-statements"
);

function getFinancialStatementsPdfPath() {
  const pdfFiles = readdirSync(FINANCIAL_STATEMENTS_DIR, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
    .map((entry) => entry.name);

  if (pdfFiles.length !== 1) {
    throw new Error(
      `Expected exactly one PDF in ${FINANCIAL_STATEMENTS_DIR}, found ${pdfFiles.length}.`
    );
  }

  return `/documents/unison-society-financial-statements/${encodeURIComponent(
    pdfFiles[0]
  )}`;
}

const financialStatementsPdfPath = getFinancialStatementsPdfPath();

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/unison-society-financial-statements",
        destination: "/unison-society-financial-statements.pdf",
        permanent: true,
      },
      {
        source: "/unison-society-financial-statements/",
        destination: "/unison-society-financial-statements.pdf",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/unison-society-financial-statements.pdf",
        destination: financialStatementsPdfPath,
      },
    ];
  },
};

export default nextConfig;
