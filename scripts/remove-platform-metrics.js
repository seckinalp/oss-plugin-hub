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
      if (Object.prototype.hasOwnProperty.call(entry, 'platformMetrics')) {
        delete entry.platformMetrics;
        removed += 1;
      }
    }

    writeJson(top100Path, data);
    console.log(`${platform}: removed platformMetrics from ${removed} entries`);
  }
}

main();
