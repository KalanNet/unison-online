import { copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sourceDir = join(
  process.cwd(),
  "public",
  "documents",
  "unison-society-financial-statements"
);
const outputFile = join(
  process.cwd(),
  "public",
  "unison-society-financial-statements.pdf"
);

const pdfFiles = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
  .map((entry) => entry.name);

if (pdfFiles.length !== 1) {
  throw new Error(
    `Expected exactly one PDF in ${sourceDir}, found ${pdfFiles.length}.`
  );
}

copyFileSync(join(sourceDir, pdfFiles[0]), outputFile);
console.log(`Synced ${pdfFiles[0]} -> ${outputFile}`);
