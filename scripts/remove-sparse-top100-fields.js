import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

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

const TOP_LEVEL_FIELDS = [
  'codeqlAlertCount',
  'codeqlError',
  'codeqlFetchedAt',
  'codeqlLastSeenAt',
  'codeqlSeverity',
  'codeqlStatus',
  'unique_installs',
  'installCount',
  'storeUrl',
  'activeInstalls',
  'addonId',
  'requires',
  'slug',
  'supportUrl',
  'tested',
  'loader',
  'modType',
  'contentType',
  'downloadCount',
];

const GITHUB_STATS_FIELDS = [
  'codeFrequency',
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

function main() {
  for (const platform of PLATFORMS) {
    const top100Path = path.join(DATA_DIR, platform, 'top100.json');
    const data = readJson(top100Path);
    if (!data || !Array.isArray(data.top100)) {
      console.warn(`Skipping ${platform}: missing top100.json`);
      continue;
    }

    let removed = 0;
    for (const entry of data.top100) {
      for (const field of TOP_LEVEL_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(entry, field)) {
          delete entry[field];
          removed += 1;
        }
      }
      if (entry.githubStats && typeof entry.githubStats === 'object') {
        for (const field of GITHUB_STATS_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(entry.githubStats, field)) {
            delete entry.githubStats[field];
            removed += 1;
          }
        }
      }
    }

    writeJson(top100Path, data);
    console.log(`${platform}: removed ${removed} fields`);
  }
}

main();
