import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const CLASSIFICATIONS_PATH = path.join(DATA_DIR, 'classifications_groq.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'classifications-summary.json');

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

function dedupeByRepo(entries) {
  const map = new Map();
  const uniqueEntries = [];
  let entriesWithRepo = 0;
  for (const entry of entries) {
    const normalized = normalizeRepo(entry?.repo);
    if (!normalized) continue;
    entriesWithRepo += 1;
    if (!map.has(normalized)) {
      map.set(normalized, entry);
      uniqueEntries.push(entry);
    }
  }
  return {
    uniqueEntries,
    repoSet: new Set(map.keys()),
    entriesWithRepo,
    uniqueRepoCount: uniqueEntries.length,
    duplicateEntryCount: entriesWithRepo - uniqueEntries.length,
  };
}

function summarizeConfidence(entries) {
  const values = entries
    .map((entry) => entry?.confidence)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeReadmeMissing(entries) {
  const count = entries.filter((entry) => entry?.readme_missing === true).length;
  return {
    count,
    rate: entries.length > 0 ? round(count / entries.length) : null,
  };
}

function toCategoryList(counter, total) {
  return Object.entries(counter)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function collectCategories(entries, key) {
  const counter = {};
  for (const entry of entries) {
    const raw = entry?.[key];
    if (!Array.isArray(raw)) continue;
    const unique = new Set(raw.filter((value) => typeof value === 'string' && value.trim() !== ''));
    for (const name of unique) {
      counter[name] = (counter[name] || 0) + 1;
    }
  }
  return counter;
}

function getPlatformTop100() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const platforms = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const platform = entry.name;
    const filePath = path.join(DATA_DIR, platform, 'top100.json');
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    if (!data || !Array.isArray(data.top100)) continue;
    platforms.push({ platform, data, filePath });
  }
  platforms.sort((a, b) => a.platform.localeCompare(b.platform));
  return platforms;
}

function summarizePlatform(platformEntry, classifiedEntries) {
  const top100 = platformEntry.data.top100 || [];
  const top100Total = top100.length;
  let top100WithRepo = 0;
  const top100GithubRepos = new Set();

  for (const plugin of top100) {
    const repoRaw = plugin?.repo;
    if (repoRaw && typeof repoRaw === 'string') top100WithRepo += 1;
    const normalized = normalizeRepo(repoRaw);
    if (normalized) top100GithubRepos.add(normalized);
  }

  const classifiedSummary = dedupeByRepo(classifiedEntries);
  const classifiedRepos = classifiedSummary.repoSet;

  const missingClassification = [];
  for (const repo of top100GithubRepos) {
    if (!classifiedRepos.has(repo)) missingClassification.push(repo);
  }

  const classifiedCount = classifiedEntries.length;
  const uniqueEntries = classifiedSummary.uniqueEntries;
  const readmeEntries = summarizeReadmeMissing(classifiedEntries);
  const readmeUnique = summarizeReadmeMissing(uniqueEntries);
  const avgConfidenceEntries = summarizeConfidence(classifiedEntries);
  const avgConfidenceUnique = summarizeConfidence(uniqueEntries);

  const genericCounts = collectCategories(uniqueEntries, 'generic_categories');
  const specificCounts = collectCategories(uniqueEntries, 'specific_categories');

  return {
    platform: platformEntry.platform,
    top100Total,
    top100WithRepo,
    top100WithGithubRepo: top100GithubRepos.size,
    classifiedCount,
    classifiedUniqueRepoCount: classifiedSummary.uniqueRepoCount,
    classifiedDuplicateEntryCount: classifiedSummary.duplicateEntryCount,
    coverageRateEntries: top100Total > 0 ? round(classifiedCount / top100Total) : null,
    coverageRateWithRepoEntries: top100WithRepo > 0 ? round(classifiedCount / top100WithRepo) : null,
    coverageRateUniqueRepo: top100GithubRepos.size > 0 ? round(classifiedSummary.uniqueRepoCount / top100GithubRepos.size) : null,
    readmeMissingCountEntries: readmeEntries.count,
    readmeMissingRateEntries: readmeEntries.rate,
    readmeMissingCountUniqueRepo: readmeUnique.count,
    readmeMissingRateUniqueRepo: readmeUnique.rate,
    avgConfidenceEntries: round(avgConfidenceEntries),
    avgConfidenceUniqueRepo: round(avgConfidenceUnique),
    genericCategories: toCategoryList(genericCounts, classifiedSummary.uniqueRepoCount),
    specificCategories: toCategoryList(specificCounts, classifiedSummary.uniqueRepoCount),
    missingClassificationCount: missingClassification.length,
    missingClassificationSample: missingClassification.slice(0, 10),
  };
}

function main() {
  const classifications = readJson(CLASSIFICATIONS_PATH, []);
  if (!Array.isArray(classifications)) {
    console.error('Expected classifications_groq.json to be an array');
    process.exit(1);
  }

  const byPlatform = {};
  for (const entry of classifications) {
    const platform = entry?.platform || 'unknown';
    if (!byPlatform[platform]) byPlatform[platform] = [];
    byPlatform[platform].push(entry);
  }

  const overallClassifiedSummary = dedupeByRepo(classifications);
  const overallReadmeEntries = summarizeReadmeMissing(classifications);
  const overallReadmeUnique = summarizeReadmeMissing(overallClassifiedSummary.uniqueEntries);
  const overallAvgConfidenceEntries = summarizeConfidence(classifications);
  const overallAvgConfidenceUnique = summarizeConfidence(overallClassifiedSummary.uniqueEntries);

  const platforms = getPlatformTop100();
  const platformSummaries = platforms.map((platformEntry) => {
    const entries = byPlatform[platformEntry.platform] || [];
    return summarizePlatform(platformEntry, entries);
  });

  const top100Totals = platformSummaries.reduce((sum, p) => sum + p.top100Total, 0);
  const top100WithRepoTotals = platformSummaries.reduce((sum, p) => sum + p.top100WithRepo, 0);
  const top100WithGithubTotals = platformSummaries.reduce((sum, p) => sum + p.top100WithGithubRepo, 0);
  const top100GithubRepoSet = new Set();
  for (const platformEntry of platforms) {
    for (const plugin of platformEntry.data.top100 || []) {
      const normalized = normalizeRepo(plugin?.repo);
      if (normalized) top100GithubRepoSet.add(normalized);
    }
  }

  const overallGeneric = collectCategories(overallClassifiedSummary.uniqueEntries, 'generic_categories');
  const overallSpecific = collectCategories(overallClassifiedSummary.uniqueEntries, 'specific_categories');

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      classificationsFile: 'data/classifications_groq.json',
      top100Dir: 'data/*/top100.json',
    },
    notes: {
      categoryCountBasis: 'uniqueRepo',
      coverageRateEntries: 'classifiedCount / top100Total',
      coverageRateUniqueRepo: 'classifiedUniqueRepoCount / top100WithGithubRepo',
      repoNormalization: 'owner/repo (github only, suffix .git removed)',
    },
    overall: {
      entryCount: classifications.length,
      uniqueRepoCount: overallClassifiedSummary.uniqueRepoCount,
      duplicateEntryCount: overallClassifiedSummary.duplicateEntryCount,
      top100Total: top100Totals,
      top100WithRepo: top100WithRepoTotals,
      top100WithGithubRepo: top100WithGithubTotals,
      top100UniqueGithubRepoCount: top100GithubRepoSet.size,
      coverageRateEntries: top100Totals > 0 ? round(classifications.length / top100Totals) : null,
      coverageRateWithRepoEntries: top100WithRepoTotals > 0 ? round(classifications.length / top100WithRepoTotals) : null,
      coverageRateUniqueRepo: top100GithubRepoSet.size > 0 ? round(overallClassifiedSummary.uniqueRepoCount / top100GithubRepoSet.size) : null,
      readmeMissingCountEntries: overallReadmeEntries.count,
      readmeMissingRateEntries: overallReadmeEntries.rate,
      readmeMissingCountUniqueRepo: overallReadmeUnique.count,
      readmeMissingRateUniqueRepo: overallReadmeUnique.rate,
      avgConfidenceEntries: round(overallAvgConfidenceEntries),
      avgConfidenceUniqueRepo: round(overallAvgConfidenceUnique),
      genericCategories: toCategoryList(overallGeneric, overallClassifiedSummary.uniqueRepoCount),
      specificCategories: toCategoryList(overallSpecific, overallClassifiedSummary.uniqueRepoCount),
    },
    platforms: platformSummaries,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
