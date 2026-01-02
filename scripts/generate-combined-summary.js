import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

const SOURCES = [
  { key: 'analyticsSummary', path: 'data/analytics-summary.json' },
  { key: 'languageLicenseSummary', path: 'data/top100-language-license-summary.json' },
  { key: 'coverageSummary', path: 'data/top100-coverage-summary.json' },
];

const OUTPUT_PATH = path.join(DATA_DIR, 'combined-summary.json');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readFile(filePath));
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function main() {
  const output = {
    generatedAt: new Date().toISOString(),
    sources: [],
  };

  for (const source of SOURCES) {
    const absolute = path.join(PROJECT_ROOT, source.path);
    const content = readFile(absolute);
    const data = JSON.parse(content);
    output[source.key] = data;
    output.sources.push({
      key: source.key,
      path: source.path,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      sha256: sha256(content),
    });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
