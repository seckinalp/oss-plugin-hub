import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const PAPER_DIR = path.join(DATA_DIR, 'paper');

const ANALYTICS_PATH = path.join(DATA_DIR, 'analytics-summary.json');
const COMBINED_PATH = path.join(PAPER_DIR, 'combined-summary.json');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function mergeMissing(target, source, stats) {
  if (!source || typeof source !== 'object') return;
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (current === undefined || current === null) {
      target[key] = value;
      stats.added += 1;
      continue;
    }
    if (Array.isArray(current) && Array.isArray(value)) {
      if (current.length === 0 && value.length > 0) {
        target[key] = value;
        stats.added += 1;
      }
      continue;
    }
    if (typeof current === 'object' && typeof value === 'object' && !Array.isArray(current) && !Array.isArray(value)) {
      mergeMissing(current, value, stats);
    }
  }
}

function main() {
  const analytics = readJson(ANALYTICS_PATH);
  const combined = readJson(COMBINED_PATH);

  if (!analytics || !Array.isArray(analytics.platforms)) {
    console.error(`Missing or invalid analytics summary at ${ANALYTICS_PATH}`);
    process.exit(1);
  }
  if (!combined || !Array.isArray(combined.platforms)) {
    console.error(`Missing or invalid combined summary at ${COMBINED_PATH}`);
    process.exit(1);
  }

  const combinedByPlatform = new Map(
    combined.platforms.map((entry) => [entry.platform, entry]),
  );

  const stats = { added: 0, missing: 0, matched: 0 };

  for (const entry of analytics.platforms) {
    const match = combinedByPlatform.get(entry.platform);
    if (!match) {
      stats.missing += 1;
      continue;
    }
    stats.matched += 1;
    mergeMissing(entry, match, stats);
  }

  if (!analytics.combinedSummaryGeneratedAt && combined.generatedAt) {
    analytics.combinedSummaryGeneratedAt = combined.generatedAt;
    stats.added += 1;
  }

  writeJson(ANALYTICS_PATH, analytics);
  console.log(`Updated ${ANALYTICS_PATH}`);
  console.log(`Matched platforms: ${stats.matched}, missing: ${stats.missing}, added fields: ${stats.added}`);
}

main();
