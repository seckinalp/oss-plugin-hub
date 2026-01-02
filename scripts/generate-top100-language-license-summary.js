import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const OUTPUT_PATH = path.join(DATA_DIR, 'top100-language-license-summary.json');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function round(value, decimals = 4) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

function extractLanguage(plugin) {
  const gh = plugin?.githubStats || {};
  const value = gh.language ?? plugin?.language ?? null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractLicense(plugin) {
  const gh = plugin?.githubStats || {};
  const value = gh.license ?? plugin?.license ?? null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTopList(counter, total, limit = 10) {
  return Object.entries(counter)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function loadTop100Entries() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(DATA_DIR, entry.name, 'top100.json');
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    if (!data || !Array.isArray(data.top100)) continue;
    for (const plugin of data.top100) {
      results.push(plugin);
    }
  }
  return results;
}

function main() {
  const entries = loadTop100Entries();
  const entryCount = entries.length;

  const entryLanguageCounts = {};
  const entryLicenseCounts = {};
  let entriesWithRepo = 0;
  const repoMap = new Map();

  for (const plugin of entries) {
    const language = extractLanguage(plugin) || 'Unknown';
    const license = extractLicense(plugin) || 'No License';
    entryLanguageCounts[language] = (entryLanguageCounts[language] || 0) + 1;
    entryLicenseCounts[license] = (entryLicenseCounts[license] || 0) + 1;

    const repo = normalizeRepo(plugin?.repo);
    if (!repo) continue;
    entriesWithRepo += 1;
    const existing = repoMap.get(repo) || { language: null, license: null };
    const extractedLanguage = extractLanguage(plugin);
    const extractedLicense = extractLicense(plugin);
    if (!existing.language && extractedLanguage) existing.language = extractedLanguage;
    if (!existing.license && extractedLicense) existing.license = extractedLicense;
    repoMap.set(repo, existing);
  }

  const uniqueRepos = Array.from(repoMap.values());
  const uniqueRepoCount = uniqueRepos.length;
  const duplicateEntryCount = entriesWithRepo - uniqueRepoCount;

  const uniqueLanguageCounts = {};
  const uniqueLicenseCounts = {};
  for (const repo of uniqueRepos) {
    const language = repo.language || 'Unknown';
    const license = repo.license || 'No License';
    uniqueLanguageCounts[language] = (uniqueLanguageCounts[language] || 0) + 1;
    uniqueLicenseCounts[license] = (uniqueLicenseCounts[license] || 0) + 1;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      top100Dir: 'data/*/top100.json',
      repoNormalization: 'owner/repo (github only, suffix .git removed)',
    },
    entryCount,
    entryWithRepoCount: entriesWithRepo,
    uniqueRepoCount,
    duplicateEntryCount,
    notes: {
      topLanguages: 'uniqueRepo',
      topLicenses: 'uniqueRepo',
    },
    topLanguages: toTopList(uniqueLanguageCounts, uniqueRepoCount),
    topLicenses: toTopList(uniqueLicenseCounts, uniqueRepoCount),
    topLanguagesEntries: toTopList(entryLanguageCounts, entryCount),
    topLicensesEntries: toTopList(entryLicenseCounts, entryCount),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
