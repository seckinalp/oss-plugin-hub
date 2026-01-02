import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const SCORECARD_DIR = path.join(PROJECT_ROOT, 'scorecard-local');
const OUTPUT_FILE = path.join(DATA_DIR, 'scorecard-platform-summary.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function round(value, decimals = 4) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function summarize(values) {
  const cleaned = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const sorted = cleaned.slice().sort((a, b) => a - b);
  const count = sorted.length;
  if (!count) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      stdev: null,
      p10: null,
      p25: null,
      p75: null,
      p90: null,
    };
  }
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
  const stdev = Math.sqrt(variance);
  return {
    count,
    min: sorted[0],
    max: sorted[count - 1],
    mean,
    median: percentile(sorted, 50),
    stdev,
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  };
}

function formatStats(stats) {
  return {
    count: stats.count,
    min: round(stats.min),
    max: round(stats.max),
    mean: round(stats.mean),
    median: round(stats.median),
    stdev: round(stats.stdev),
    p10: round(stats.p10),
    p25: round(stats.p25),
    p75: round(stats.p75),
    p90: round(stats.p90),
  };
}

function scoreHistogram(values) {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    range: `${i}-${i + 1}`,
    count: 0,
    rate: 0,
  }));
  const cleaned = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  for (const value of cleaned) {
    const idx = Math.min(Math.max(Math.floor(value), 0), 9);
    bins[idx].count += 1;
  }
  const total = cleaned.length;
  for (const bin of bins) {
    bin.rate = total > 0 ? round(bin.count / total) : 0;
  }
  return bins;
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

function loadScorecards() {
  const map = new Map();
  const files = fs.existsSync(SCORECARD_DIR)
    ? fs.readdirSync(SCORECARD_DIR).filter((f) => f.endsWith('.json'))
    : [];
  let scorecardVersion = null;
  let scorecardCommit = null;
  let duplicateCount = 0;
  const dates = [];

  for (const file of files) {
    const filePath = path.join(SCORECARD_DIR, file);
    const data = readJson(filePath);
    if (!data) continue;
    const repoSlug = normalizeRepo(data?.repo?.name);
    if (!repoSlug) continue;
    if (map.has(repoSlug)) duplicateCount += 1;
    map.set(repoSlug, {
      repo: repoSlug,
      score: data.score,
      checks: Array.isArray(data.checks) ? data.checks : [],
      date: data.date || null,
    });
    if (!scorecardVersion && data?.scorecard?.version) {
      scorecardVersion = data.scorecard.version;
    }
    if (!scorecardCommit && data?.scorecard?.commit) {
      scorecardCommit = data.scorecard.commit;
    }
    if (data.date) dates.push(data.date);
  }

  return {
    map,
    totalFiles: files.length,
    duplicateCount,
    scorecardVersion,
    scorecardCommit,
    dates,
  };
}

function getTop100Platforms() {
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

function collectCheckStats(entries) {
  const map = new Map();
  for (const entry of entries) {
    const checks = Array.isArray(entry.checks) ? entry.checks : [];
    for (const check of checks) {
      const name = check?.name || 'Unknown';
      const score = check?.score;
      const rec = map.get(name) || {
        totalCount: 0,
        naCount: 0,
        values: [],
        zeroCount: 0,
        perfectCount: 0,
      };
      rec.totalCount += 1;
      if (score === -1 || score === null || score === undefined) {
        rec.naCount += 1;
      } else if (typeof score === 'number' && Number.isFinite(score)) {
        rec.values.push(score);
        if (score === 0) rec.zeroCount += 1;
        if (score === 10) rec.perfectCount += 1;
      }
      map.set(name, rec);
    }
  }

  const result = {};
  for (const [name, rec] of map.entries()) {
    const stats = summarize(rec.values);
    result[name] = {
      totalCount: rec.totalCount,
      applicableCount: rec.values.length,
      naCount: rec.naCount,
      naRate: rec.totalCount > 0 ? round(rec.naCount / rec.totalCount) : null,
      zeroCount: rec.zeroCount,
      perfectCount: rec.perfectCount,
      min: round(stats.min),
      max: round(stats.max),
      mean: round(stats.mean),
      median: round(stats.median),
      stdev: round(stats.stdev),
      p10: round(stats.p10),
      p25: round(stats.p25),
      p75: round(stats.p75),
      p90: round(stats.p90),
    };
  }
  return result;
}

function dateRange(dates) {
  const times = dates
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t));
  if (!times.length) {
    return { min: null, max: null };
  }
  return {
    min: new Date(Math.min(...times)).toISOString(),
    max: new Date(Math.max(...times)).toISOString(),
  };
}

function summarizeEntries(entries) {
  const scores = entries.map((entry) => entry.score).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const stats = summarize(scores);
  const formatted = formatStats(stats);
  return {
    scoreStats: formatted,
    scoreHistogram: scoreHistogram(scores),
    checkStats: collectCheckStats(entries),
  };
}

function topBottom(entries, limit = 5) {
  const sorted = entries
    .filter((entry) => typeof entry.score === 'number' && Number.isFinite(entry.score))
    .slice()
    .sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, limit).map((entry) => ({ repo: entry.repo, score: entry.score }));
  const bottom = sorted.slice(-limit).reverse().map((entry) => ({ repo: entry.repo, score: entry.score }));
  return { top, bottom };
}

function buildPlatformSummary(platformEntry, scorecardMap) {
  const { platform, data } = platformEntry;
  const top100 = data.top100 || [];
  const repoEntries = [];
  let missingRepoCount = 0;
  let nonGithubCount = 0;

  for (const plugin of top100) {
    const repoRaw = plugin?.repo;
    if (!repoRaw) {
      missingRepoCount += 1;
      continue;
    }
    const normalized = normalizeRepo(repoRaw);
    if (!normalized) {
      nonGithubCount += 1;
      continue;
    }
    repoEntries.push({ repo: normalized });
  }

  const uniqueRepos = Array.from(new Set(repoEntries.map((entry) => entry.repo)));
  const matchedEntries = [];
  const missingScorecard = [];
  const dates = [];

  for (const repo of uniqueRepos) {
    const scorecard = scorecardMap.get(repo);
    if (!scorecard) {
      missingScorecard.push(repo);
      continue;
    }
    matchedEntries.push({
      repo,
      score: scorecard.score,
      checks: scorecard.checks,
      date: scorecard.date,
    });
    if (scorecard.date) dates.push(scorecard.date);
  }

  const coverageRate = uniqueRepos.length > 0 ? matchedEntries.length / uniqueRepos.length : 0;
  const summary = summarizeEntries(matchedEntries);
  const topBottomRepos = topBottom(matchedEntries);

  return {
    platform,
    top100Total: top100.length,
    top100WithRepo: repoEntries.length,
    uniqueRepoCount: uniqueRepos.length,
    missingRepoCount,
    nonGithubRepoCount: nonGithubCount,
    scorecardMatches: matchedEntries.length,
    coverageRate: round(coverageRate),
    scorecardDateRange: dateRange(dates),
    ...summary,
    topRepos: topBottomRepos.top,
    bottomRepos: topBottomRepos.bottom,
    missingScorecardCount: missingScorecard.length,
    missingScorecardSample: missingScorecard.slice(0, 10),
  };
}

function main() {
  const scorecardData = loadScorecards();
  const platforms = getTop100Platforms();
  const scorecardMap = scorecardData.map;

  const platformSummaries = [];
  const allPlatformEntries = [];
  const allPlatformRepoSet = new Set();
  let totalTop100Entries = 0;
  let totalEntriesWithRepo = 0;
  let totalScorecardMatches = 0;

  for (const platformEntry of platforms) {
    const summary = buildPlatformSummary(platformEntry, scorecardMap);
    platformSummaries.push(summary);

    totalTop100Entries += summary.top100Total;
    totalEntriesWithRepo += summary.top100WithRepo;
    totalScorecardMatches += summary.scorecardMatches;

    const uniqueRepos = new Set();
    for (const plugin of platformEntry.data.top100 || []) {
      const repo = normalizeRepo(plugin?.repo);
      if (!repo) continue;
      uniqueRepos.add(repo);
    }
    for (const repo of uniqueRepos) {
      allPlatformRepoSet.add(repo);
      const scorecard = scorecardMap.get(repo);
      if (!scorecard) continue;
      allPlatformEntries.push({
        repo,
        score: scorecard.score,
        checks: scorecard.checks,
        date: scorecard.date,
        platform: platformEntry.platform,
      });
    }
  }

  const uniqueRepoEntries = [];
  const uniqueRepoDates = [];
  for (const repo of allPlatformRepoSet) {
    const scorecard = scorecardMap.get(repo);
    if (!scorecard) continue;
    uniqueRepoEntries.push({
      repo,
      score: scorecard.score,
      checks: scorecard.checks,
      date: scorecard.date,
    });
    if (scorecard.date) uniqueRepoDates.push(scorecard.date);
  }

  const unmatchedScorecards = [];
  for (const repo of scorecardMap.keys()) {
    if (!allPlatformRepoSet.has(repo)) unmatchedScorecards.push(repo);
  }

  const overallUnique = summarizeEntries(uniqueRepoEntries);
  const overallEntries = summarizeEntries(allPlatformEntries);
  const overallTopBottomUnique = topBottom(uniqueRepoEntries);
  const overallTopBottomEntries = topBottom(allPlatformEntries);

  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      scorecardDir: 'scorecard-local',
      top100Dir: 'data/*/top100.json',
      scorecardVersion: scorecardData.scorecardVersion,
      scorecardCommit: scorecardData.scorecardCommit,
      scorecardFileCount: scorecardData.totalFiles,
      scorecardDuplicateRepoCount: scorecardData.duplicateCount,
      platformsDetected: platforms.map((p) => p.platform),
    },
    notes: {
      scorecardScale: '0-10',
      notApplicableScore: -1,
      notApplicableMeaning: 'check not applicable for the repo',
      coverageDefinition: 'scorecardMatches / uniqueRepoCount',
    },
    platforms: platformSummaries,
    overall: {
      platformEntryTotals: {
        totalTop100Entries,
        totalEntriesWithRepo,
        totalScorecardMatches,
        coverageRate: totalEntriesWithRepo > 0 ? round(totalScorecardMatches / totalEntriesWithRepo) : null,
      },
      uniqueRepos: {
        repoCount: allPlatformRepoSet.size,
        scorecardMatches: uniqueRepoEntries.length,
        coverageRate: allPlatformRepoSet.size > 0 ? round(uniqueRepoEntries.length / allPlatformRepoSet.size) : null,
        scorecardDateRange: dateRange(uniqueRepoDates),
        ...overallUnique,
        topRepos: overallTopBottomUnique.top,
        bottomRepos: overallTopBottomUnique.bottom,
      },
      platformEntries: {
        entryCount: allPlatformEntries.length,
        scorecardDateRange: dateRange(allPlatformEntries.map((entry) => entry.date).filter(Boolean)),
        ...overallEntries,
        topRepos: overallTopBottomEntries.top,
        bottomRepos: overallTopBottomEntries.bottom,
      },
    },
    unmatchedScorecards: {
      count: unmatchedScorecards.length,
      sample: unmatchedScorecards.slice(0, 10),
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUTPUT_FILE}`);
}

main();
