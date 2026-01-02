import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const OUTPUT_PATH = path.join(DATA_DIR, 'paper', 'top100-field-coverage.json');

const PLATFORMS = [
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

const NESTED_TARGETS = [
  'githubStats',
  'scorecard',
  'dependencySummary',
  'vulnerabilitySummary',
  'vulnerabilityAnalysis',
  'sbom_analysis',
  'classification',
  'repoDup',
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

function isNonEmpty(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function record(map, key, value) {
  if (!map.has(key)) {
    map.set(key, { present: 0, nonNull: 0, nonEmpty: 0 });
  }
  const stats = map.get(key);
  stats.present += 1;
  if (value !== null && value !== undefined) {
    stats.nonNull += 1;
  }
  if (isNonEmpty(value)) {
    stats.nonEmpty += 1;
  }
}

function main() {
  const coverage = new Map();
  const entries = [];

  for (const platform of PLATFORMS) {
    const top100Path = path.join(DATA_DIR, platform, 'top100.json');
    const data = readJson(top100Path);
    if (!data || !Array.isArray(data.top100)) {
      console.warn(`Skipping ${platform}: missing top100.json`);
      continue;
    }
    for (const entry of data.top100) {
      entries.push({ platform, entry });
    }
  }

  const totalEntries = entries.length;
  for (const { entry } of entries) {
    for (const [key, value] of Object.entries(entry)) {
      record(coverage, key, value);
    }

    for (const target of NESTED_TARGETS) {
      const nested = entry[target];
      if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        record(coverage, `${target}.${nestedKey}`, nestedValue);
      }
    }

    const checkScores = entry.scorecard?.checkScores;
    if (checkScores && typeof checkScores === 'object' && !Array.isArray(checkScores)) {
      for (const [name, value] of Object.entries(checkScores)) {
        record(coverage, `scorecard.checkScores.${name}`, value);
      }
    }
  }

  const fields = Array.from(coverage.entries())
    .map(([field, stats]) => {
      const missing = totalEntries - stats.present;
      return {
        field,
        present: stats.present,
        nonNull: stats.nonNull,
        nonEmpty: stats.nonEmpty,
        missing,
        missingRate: totalEntries > 0 ? missing / totalEntries : null,
      };
    })
    .sort((a, b) => b.missing - a.missing || a.field.localeCompare(b.field));

  const output = {
    generatedAt: new Date().toISOString(),
    totalEntries,
    platforms: PLATFORMS,
    fields,
  };

  writeJson(OUTPUT_PATH, output);

  const missingFields = fields.filter((f) => f.missing > 0).slice(0, 20);
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log('Top missing fields (by missing count):');
  for (const item of missingFields) {
    console.log(`${item.field}: missing ${item.missing}/${totalEntries}`);
  }
}

main();
