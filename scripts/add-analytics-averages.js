import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const ANALYTICS_PATH = path.join(DATA_DIR, 'analytics-summary.json');
const PLATFORM_DIRS = [
  'chrome',
  'firefox',
  'homeassistant',
  'jetbrains',
  'minecraft',
  'obsidian',
  'sublime',
  'vscode',
  'wordpress',
];

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

function buildAveragesFromTotals(totals, count) {
  if (!totals || typeof totals !== 'object' || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  const averages = {};
  for (const [key, value] of Object.entries(totals)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    averages[key] = value / count;
  }
  return averages;
}

function loadTop100(platform) {
  const top100Path = path.join(DATA_DIR, platform, 'top100.json');
  const data = readJson(top100Path);
  if (!data || !Array.isArray(data.top100)) return null;
  return data.top100;
}

function buildScorecardCheckAverages(top100) {
  const sums = {};
  const counts = {};
  for (const entry of top100) {
    const scores = entry?.scorecard?.checkScores;
    if (!scores || typeof scores !== 'object') continue;
    for (const [name, value] of Object.entries(scores)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      sums[name] = (sums[name] || 0) + value;
      counts[name] = (counts[name] || 0) + 1;
    }
  }
  const averages = {};
  for (const [name, sum] of Object.entries(sums)) {
    const count = counts[name] || 0;
    averages[name] = count > 0 ? sum / count : null;
  }
  return { averages, counts };
}

function main() {
  const analytics = readJson(ANALYTICS_PATH);
  if (!analytics || !Array.isArray(analytics.platforms)) {
    console.error(`Missing or invalid analytics summary at ${ANALYTICS_PATH}`);
    process.exit(1);
  }

  for (const entry of analytics.platforms) {
    const count = Number.isFinite(entry.top100Count) ? entry.top100Count : 0;
    const averages = buildAveragesFromTotals(entry.totals, count);
    if (averages) {
      entry.totalsAverages = averages;
    }

    const platform = entry.platform;
    if (PLATFORM_DIRS.includes(platform)) {
      const top100 = loadTop100(platform);
      if (top100) {
        const scorecardStats = buildScorecardCheckAverages(top100);
        entry.scorecardCheckAverages = scorecardStats.averages;
        entry.scorecardCheckCounts = scorecardStats.counts;
      }
    }
  }

  analytics.averagesGeneratedAt = new Date().toISOString();
  writeJson(ANALYTICS_PATH, analytics);
  console.log(`Updated ${ANALYTICS_PATH}`);
}

main();
