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

function normalizeRepo(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let repo = raw.trim();
  const lower = repo.toLowerCase();
  if ((lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('git@')) && !lower.includes('github.com')) {
    return null;
  }
  repo = repo.replace(/^https?:\/\/github\.com\//i, '');
  repo = repo.replace(/^git@github\.com:/i, '');
  repo = repo.replace(/^github\.com\//i, '');
  repo = repo.replace(/\.git$/i, '');
  repo = repo.split('#')[0].split('?')[0];
  repo = repo.replace(/\/+$/, '');
  const parts = repo.split('/');
  if (parts.length < 2) return null;
  return `${parts[0]}/${parts[1]}`;
}

function mergeMissing(target, source, stats) {
  if (!source || typeof source !== 'object') return target;
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
  return target;
}

function buildSourceMap(entries) {
  const byId = new Map();
  const byRepo = new Map();

  for (const entry of entries) {
    if (entry.id) {
      byId.set(String(entry.id), entry);
    }
    const repo = normalizeRepo(entry.repo);
    if (repo) {
      byRepo.set(repo.toLowerCase(), entry);
    }
  }

  return { byId, byRepo };
}

function main() {
  for (const platform of PLATFORMS) {
    const top100Path = path.join(DATA_DIR, platform, 'top100.json');
    const sbomPath = path.join(DATA_DIR, platform, 'top100.sbom_analysis.json');

    const top100 = readJson(top100Path);
    const sbom = readJson(sbomPath);

    if (!top100 || !Array.isArray(top100.top100)) {
      console.warn(`Skipping ${platform}: missing top100.json`);
      continue;
    }
    if (!sbom || !Array.isArray(sbom.top100)) {
      console.warn(`Skipping ${platform}: missing top100.sbom_analysis.json`);
      continue;
    }

    const sourceMap = buildSourceMap(sbom.top100);
    const stats = { added: 0, missing: 0, matched: 0 };

    for (const entry of top100.top100) {
      const byId = entry.id ? sourceMap.byId.get(String(entry.id)) : null;
      const repo = normalizeRepo(entry.repo);
      const byRepo = repo ? sourceMap.byRepo.get(repo.toLowerCase()) : null;
      const source = byId || byRepo;
      if (!source) {
        stats.missing += 1;
        continue;
      }
      stats.matched += 1;
      mergeMissing(entry, source, stats);
    }

    writeJson(top100Path, top100);
    console.log(`${platform}: matched ${stats.matched}, missing ${stats.missing}, added fields ${stats.added}`);
  }
}

main();
