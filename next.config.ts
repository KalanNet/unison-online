import type { NextConfig } from "next";
import { copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FINANCIAL_STATEMENTS_DIR = join(
  process.cwd(),
  "public",
  "documents",
  "unison-society-financial-statements"
);
const FINANCIAL_STATEMENTS_PUBLIC_FILE = join(
  process.cwd(),
  "public",
  "unison-society-financial-statements.pdf"
);

function syncFinancialStatementsPdf() {
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

  copyFileSync(
    join(FINANCIAL_STATEMENTS_DIR, pdfFiles[0]),
    FINANCIAL_STATEMENTS_PUBLIC_FILE
  );
}

syncFinancialStatementsPdf();

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
};

export default nextConfig;
