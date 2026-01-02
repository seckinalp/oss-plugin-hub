import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const OSV_DIR = path.join(DATA_DIR, 'osv-scans');
const SCORECARD_DIR = path.join(PROJECT_ROOT, 'scorecard-local');
const OUTPUT_PATH = path.join(DATA_DIR, 'top100-coverage-summary.json');

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

function repoKey(raw) {
  return normalizeRepo(raw);
}

function loadTop100Platforms() {
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
    platforms.push({ platform, data });
  }
  platforms.sort((a, b) => a.platform.localeCompare(b.platform));
  return platforms;
}

function loadOsvSummaries() {
  const map = new Map();
  if (!fs.existsSync(OSV_DIR)) return map;
  const files = fs.readdirSync(OSV_DIR).filter((f) => f.endsWith('.analysis.json'));
  for (const file of files) {
    const data = readJson(path.join(OSV_DIR, file));
    if (!data || !data.summary) continue;
    const repoFromFile = file.replace(/\.analysis\.json$/i, '').replace(/__/g, '/');
    const key = repoKey(repoFromFile);
    if (!key) continue;
    map.set(key, {
      repo: repoFromFile,
      summary: data.summary,
    });
  }
  return map;
}

function loadScorecardRepos() {
  const set = new Set();
  if (!fs.existsSync(SCORECARD_DIR)) return set;
  const files = fs.readdirSync(SCORECARD_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const data = readJson(path.join(SCORECARD_DIR, file));
    const repoRaw = data?.repo?.name || file.replace(/\.json$/i, '').replace(/__/g, '/');
    const key = repoKey(repoRaw);
    if (!key) continue;
    set.add(key);
  }
  return set;
}

function collectRepoKeys(top100) {
  const keys = [];
  for (const plugin of top100) {
    const key = repoKey(plugin?.repo);
    if (key) keys.push(key);
  }
  return keys;
}

function summarizeOsv(uniqueRepoKeys, entryRepoKeys, osvMap) {
  const uniqueSummaries = [];
  for (const key of uniqueRepoKeys) {
    const rec = osvMap.get(key);
    if (rec) uniqueSummaries.push(rec.summary);
  }

  const analyzedUniqueRepoCount = uniqueSummaries.length;
  const analyzedEntryCount = entryRepoKeys.filter((key) => osvMap.has(key)).length;
  const affectedUniqueCount = uniqueSummaries.filter((s) => (s?.totalVulnerabilities || 0) > 0).length;
  const cleanUniqueCount = analyzedUniqueRepoCount - affectedUniqueCount;
  const highRiskUniqueCount = uniqueSummaries.filter((s) => {
    const sev = s?.severityBreakdown || {};
    return (sev.CRITICAL || 0) > 0 || (sev.HIGH || 0) > 0;
  }).length;

  const totals = {
    totalVulnerabilities: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    stalePackages: 0,
    oldFixesAvailable: 0,
    recentVulnerabilities: 0,
  };

  for (const s of uniqueSummaries) {
    const sev = s?.severityBreakdown || {};
    totals.totalVulnerabilities += s?.totalVulnerabilities || 0;
    totals.critical += sev.CRITICAL || 0;
    totals.high += sev.HIGH || 0;
    totals.medium += sev.MEDIUM || 0;
    totals.low += sev.LOW || 0;
    totals.stalePackages += s?.stalePackages || 0;
    totals.oldFixesAvailable += s?.stalePackagesOldFix || 0;
    totals.recentVulnerabilities += s?.recentVulnerabilities || 0;
  }

  return {
    analyzedUniqueRepoCount,
    analyzedEntryCount,
    coverageRateUniqueRepo: uniqueRepoKeys.size > 0 ? round(analyzedUniqueRepoCount / uniqueRepoKeys.size) : null,
    coverageRateEntries: entryRepoKeys.length > 0 ? round(analyzedEntryCount / entryRepoKeys.length) : null,
    affectedUniqueCount,
    cleanUniqueCount,
    affectedRate: analyzedUniqueRepoCount > 0 ? round(affectedUniqueCount / analyzedUniqueRepoCount) : null,
    highRiskUniqueCount,
    highRiskRate: analyzedUniqueRepoCount > 0 ? round(highRiskUniqueCount / analyzedUniqueRepoCount) : null,
    totals,
    avgVulnerabilitiesPerRepo: analyzedUniqueRepoCount > 0 ? round(totals.totalVulnerabilities / analyzedUniqueRepoCount) : null,
    avgVulnerabilitiesPerAffectedRepo:
      affectedUniqueCount > 0 ? round(totals.totalVulnerabilities / affectedUniqueCount) : null,
  };
}

function summarizeScorecard(uniqueRepoKeys, entryRepoKeys, scorecardSet) {
  const analyzedUniqueRepoCount = Array.from(uniqueRepoKeys).filter((key) => scorecardSet.has(key)).length;
  const analyzedEntryCount = entryRepoKeys.filter((key) => scorecardSet.has(key)).length;
  return {
    analyzedUniqueRepoCount,
    analyzedEntryCount,
    coverageRateUniqueRepo: uniqueRepoKeys.size > 0 ? round(analyzedUniqueRepoCount / uniqueRepoKeys.size) : null,
    coverageRateEntries: entryRepoKeys.length > 0 ? round(analyzedEntryCount / entryRepoKeys.length) : null,
  };
}

function summarizePlatform(platformEntry, osvMap, scorecardSet) {
  const top100 = platformEntry.data.top100 || [];
  const top100Total = top100.length;
  const entryRepoKeys = collectRepoKeys(top100);
  const entryRepoCount = entryRepoKeys.length;
  const uniqueRepoKeys = new Set(entryRepoKeys);
  const uniqueRepoCount = uniqueRepoKeys.size;
  const duplicateEntryCount = entryRepoCount - uniqueRepoCount;

  return {
    platform: platformEntry.platform,
    top100Total,
    entryRepoCount,
    uniqueRepoCount,
    duplicateEntryCount,
    vulnerability: summarizeOsv(uniqueRepoKeys, entryRepoKeys, osvMap),
    scorecard: summarizeScorecard(uniqueRepoKeys, entryRepoKeys, scorecardSet),
  };
}

function main() {
  const platforms = loadTop100Platforms();
  const osvMap = loadOsvSummaries();
  const scorecardSet = loadScorecardRepos();

  const platformSummaries = platforms.map((platformEntry) =>
    summarizePlatform(platformEntry, osvMap, scorecardSet)
  );

  const allTop100 = platforms.flatMap((p) => p.data.top100 || []);
  const allEntryRepoKeys = collectRepoKeys(allTop100);
  const allUniqueRepoKeys = new Set(allEntryRepoKeys);

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      top100Dir: 'data/*/top100.json',
      osvDir: 'data/osv-scans',
      scorecardDir: 'scorecard-local',
      repoNormalization: 'owner/repo (github only, suffix .git removed)',
    },
    overall: {
      top100Total: allTop100.length,
      entryRepoCount: allEntryRepoKeys.length,
      uniqueRepoCount: allUniqueRepoKeys.size,
      duplicateEntryCount: allEntryRepoKeys.length - allUniqueRepoKeys.size,
      vulnerability: summarizeOsv(allUniqueRepoKeys, allEntryRepoKeys, osvMap),
      scorecard: summarizeScorecard(allUniqueRepoKeys, allEntryRepoKeys, scorecardSet),
    },
    platforms: platformSummaries,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
