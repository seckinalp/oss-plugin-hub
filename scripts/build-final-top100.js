import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const PAPER_DIR = path.join(DATA_DIR, 'paper');
const SCORECARD_DIR = path.join(PROJECT_ROOT, 'scorecard-local');
const SBOM_DIR = path.join(DATA_DIR, 'sbom');
const OSV_DIR = path.join(DATA_DIR, 'osv-scans');

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

function normalizeName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pluginKey(platform, id) {
  if (!platform || !id) return null;
  return `${platform.toLowerCase()}::${id.toLowerCase()}`;
}

function repoKey(repo) {
  if (!repo) return null;
  return repo.toLowerCase();
}

function buildRepoFilenameMap(dirPath, suffix) {
  const map = new Map();
  if (!fs.existsSync(dirPath)) return map;
  const files = fs.readdirSync(dirPath).filter((name) => name.endsWith(suffix));
  for (const file of files) {
    const base = file.slice(0, -suffix.length);
    const repo = base.replace(/__/g, '/').toLowerCase();
    map.set(repo, path.join(dirPath, file));
  }
  return map;
}

function extractPurlEcosystem(purl) {
  if (!purl || typeof purl !== 'string') return null;
  if (!purl.startsWith('pkg:')) return null;
  const withoutPrefix = purl.slice(4);
  const slashIndex = withoutPrefix.indexOf('/');
  const atIndex = withoutPrefix.indexOf('@');
  const endIndex = slashIndex === -1 ? atIndex : slashIndex;
  if (endIndex === -1) return withoutPrefix || null;
  return withoutPrefix.slice(0, endIndex) || null;
}

function loadScorecardMap() {
  const map = new Map();
  if (!fs.existsSync(SCORECARD_DIR)) return map;
  const files = fs.readdirSync(SCORECARD_DIR).filter((name) => name.endsWith('.json'));
  for (const file of files) {
    const data = readJson(path.join(SCORECARD_DIR, file));
    if (!data) continue;
    const repo = normalizeRepo(data.repo?.name || data.repo?.url);
    if (!repo) continue;
    const checks = Array.isArray(data.checks)
      ? data.checks
      : Array.isArray(data.scorecard?.checks)
        ? data.scorecard.checks
        : [];
    const checkScores = {};
    for (const check of checks) {
      if (!check || !check.name) continue;
      checkScores[check.name] = typeof check.score === 'number' ? check.score : null;
    }
    map.set(repoKey(repo), {
      score: typeof data.score === 'number' ? data.score : null,
      checks,
      checkScores,
      scorecardVersion: data.scorecard?.version || null,
      scanDate: data.date || null,
    });
  }
  return map;
}

function loadClassificationMaps() {
  const classifications = readJson(path.join(DATA_DIR, 'classifications_groq.json'), []);
  const byPlatformRepo = new Map();
  const byRepo = new Map();
  const byPlatformName = new Map();

  for (const entry of classifications) {
    const platform = entry.platform?.toLowerCase();
    const repo = normalizeRepo(entry.repo);
    const name = normalizeName(entry.name);
    if (platform && repo) {
      byPlatformRepo.set(`${platform}::${repoKey(repo)}`, entry);
    }
    if (repo) {
      byRepo.set(repoKey(repo), entry);
    }
    if (platform && name) {
      byPlatformName.set(`${platform}::${name}`, entry);
    }
  }

  return { byPlatformRepo, byRepo, byPlatformName };
}

function loadRepoDupMaps() {
  const repoDup = readJson(path.join(PAPER_DIR, 'repo-duplication-analysis.json'), {});
  const allPlugins = Array.isArray(repoDup.allPlugins) ? repoDup.allPlugins : [];
  const pluginMap = new Map();
  const repoMap = new Map();

  for (const entry of allPlugins) {
    const key = pluginKey(entry.platform, entry.pluginId);
    if (key) pluginMap.set(key, entry);
    const repo = normalizeRepo(entry.repo);
    if (repo && !repoMap.has(repoKey(repo))) {
      repoMap.set(repoKey(repo), entry);
    }
  }

  const categoryMap = new Map();
  const categories = repoDup.categories || {};
  for (const group of Object.values(categories)) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      const repo = normalizeRepo(item.repo);
      if (!repo) continue;
      categoryMap.set(repoKey(repo), {
        category: item.category || null,
        categoryDescription: item.categoryDescription || null,
      });
    }
  }

  return { pluginMap, repoMap, categoryMap };
}

function buildClassification(entry, maps, platform, repo, name, author) {
  const platformKey = platform?.toLowerCase() || null;
  const repoNormalized = repoKey(repo);
  const nameKey = normalizeName(name);
  const authorKey = normalizeName(author);

  let matched = null;
  if (platformKey && repoNormalized) {
    matched = maps.byPlatformRepo.get(`${platformKey}::${repoNormalized}`) || null;
  }
  if (!matched && repoNormalized) {
    matched = maps.byRepo.get(repoNormalized) || null;
  }
  if (!matched && platformKey && nameKey) {
    matched = maps.byPlatformName.get(`${platformKey}::${nameKey}`) || null;
  }
  if (!matched && platformKey && nameKey && authorKey) {
    matched = maps.byPlatformName.get(`${platformKey}::${nameKey}`) || null;
  }

  const generic = matched?.generic_categories || [];
  const specific = matched?.specific_categories || [];
  const label = (Array.isArray(specific) && specific[0])
    || (Array.isArray(generic) && generic[0])
    || null;

  return {
    data: {
      label,
      confidence: typeof matched?.confidence === 'number' ? matched.confidence : null,
      categories: {
        generic: Array.isArray(generic) ? generic : [],
        specific: Array.isArray(specific) ? specific : [],
      },
      tags: [],
    },
    matched,
  };
}

function buildRepoDup(entry, repoDupMaps, repo) {
  const repoNormalized = repoKey(repo);
  const pluginInfo = entry || (repoNormalized ? repoDupMaps.repoMap.get(repoNormalized) : null);
  const categoryInfo = repoNormalized ? repoDupMaps.categoryMap.get(repoNormalized) : null;

  return {
    category: pluginInfo?.category || categoryInfo?.category || null,
    categoryDescription: categoryInfo?.categoryDescription || null,
    sharesRepoWith: typeof pluginInfo?.sharesRepoWith === 'number' ? pluginInfo.sharesRepoWith : null,
    totalPluginsInRepo: typeof pluginInfo?.totalPluginsInRepo === 'number' ? pluginInfo.totalPluginsInRepo : null,
    ownership: pluginInfo?.ownership || null,
    isVerified: typeof pluginInfo?.isVerified === 'boolean' ? pluginInfo.isVerified : null,
    isCorporate: typeof pluginInfo?.isCorporate === 'boolean' ? pluginInfo.isCorporate : null,
  };
}

function buildSbomSummary(repo, sbomMap) {
  const repoNormalized = repoKey(repo);
  if (!repoNormalized) return null;
  const filePath = sbomMap.get(repoNormalized);
  if (!filePath) return null;
  const data = readJson(filePath);
  if (!data) return null;
  const packages = Array.isArray(data.packages) ? data.packages : [];
  const ecosystems = new Set();
  for (const pkg of packages) {
    const refs = Array.isArray(pkg.externalRefs) ? pkg.externalRefs : [];
    for (const ref of refs) {
      if (ref.referenceType !== 'purl') continue;
      const ecosystem = extractPurlEcosystem(ref.referenceLocator);
      if (ecosystem) ecosystems.add(ecosystem);
    }
  }
  return {
    sbomPackageCount: packages.length,
    sbomDependencyCount: Math.max(packages.length - 1, 0),
    ecosystems: Array.from(ecosystems).sort(),
  };
}

function buildOsvSummary(repo, osvMap) {
  const repoNormalized = repoKey(repo);
  if (!repoNormalized) return null;
  const filePath = osvMap.get(repoNormalized);
  if (!filePath) return null;
  const data = readJson(filePath);
  if (!data) return null;
  const summary = data.summary || {};
  const breakdown = summary.severityBreakdown || {};
  return {
    total: typeof summary.totalVulnerabilities === 'number' ? summary.totalVulnerabilities : null,
    unique: typeof summary.uniqueVulnerabilities === 'number' ? summary.uniqueVulnerabilities : null,
    critical: typeof breakdown.CRITICAL === 'number' ? breakdown.CRITICAL : null,
    high: typeof breakdown.HIGH === 'number' ? breakdown.HIGH : null,
    medium: typeof breakdown.MEDIUM === 'number' ? breakdown.MEDIUM : null,
    low: typeof breakdown.LOW === 'number' ? breakdown.LOW : null,
    stalePackages: typeof summary.stalePackages === 'number' ? summary.stalePackages : null,
    recentVulns: typeof summary.recentVulnerabilities === 'number' ? summary.recentVulnerabilities : null,
  };
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function main() {
  const classificationMaps = loadClassificationMaps();
  const repoDupMaps = loadRepoDupMaps();
  const scorecardMap = loadScorecardMap();
  const sbomMap = buildRepoFilenameMap(SBOM_DIR, '.sbom.json');
  const osvMap = buildRepoFilenameMap(OSV_DIR, '.analysis.json');

  const missing = {
    classification: [],
    repoDup: [],
    scorecard: [],
    sbom: [],
    osv: [],
  };

  const platformSummaries = [];

  for (const platform of PLATFORMS) {
    const top100Path = path.join(DATA_DIR, platform, 'top100.json');
    const top100Data = readJson(top100Path);
    if (!top100Data || !Array.isArray(top100Data.top100)) {
      console.warn(`Skipping ${platform}: missing top100.json`);
      continue;
    }

    const enriched = [];
    for (const entry of top100Data.top100) {
      const entryPlatform = entry.platform || platform;
      const key = pluginKey(entryPlatform, entry.id);
      const repo = normalizeRepo(entry.repo);

      const pluginInfo = key ? repoDupMaps.pluginMap.get(key) : null;
      if (!pluginInfo) missing.repoDup.push(`${entryPlatform}:${entry.id}`);

      const classificationResult = buildClassification(
        entry,
        classificationMaps,
        entryPlatform,
        repo,
        entry.name,
        entry.author,
      );
      if (!classificationResult.matched) {
        missing.classification.push(`${entryPlatform}:${entry.id}`);
      }

      const scorecard = repo ? scorecardMap.get(repoKey(repo)) : null;
      if (!scorecard) missing.scorecard.push(`${entryPlatform}:${entry.id}`);

      const sbomSummary = repo ? buildSbomSummary(repo, sbomMap) : null;
      if (!sbomSummary) missing.sbom.push(`${entryPlatform}:${entry.id}`);

      const osvSummary = repo ? buildOsvSummary(repo, osvMap) : null;
      if (!osvSummary) missing.osv.push(`${entryPlatform}:${entry.id}`);

      const repoDup = buildRepoDup(pluginInfo, repoDupMaps, repo);

      enriched.push({
        ...entry,
        classification: classificationResult.data,
        repoDup,
        scorecard: scorecard || {
          score: null,
          checks: [],
          checkScores: {},
          scorecardVersion: null,
          scanDate: null,
        },
        dependencySummary: sbomSummary || {
          sbomPackageCount: null,
          sbomDependencyCount: null,
          ecosystems: [],
        },
        vulnerabilitySummary: osvSummary || {
          total: null,
          unique: null,
          critical: null,
          high: null,
          medium: null,
          low: null,
          stalePackages: null,
          recentVulns: null,
        },
      });
    }

    top100Data.top100 = enriched;
    writeJson(top100Path, top100Data);
    console.log(`Updated ${top100Path}`);

    const totals = {
      downloads: 0,
      users: 0,
      installs: 0,
      activeInstalls: 0,
      stars: 0,
      forks: 0,
      openIssues: 0,
      dependencyPackages: 0,
      dependencyCount: 0,
      vulnerabilitiesTotal: 0,
      vulnerabilitiesUnique: 0,
      vulnerabilitiesCritical: 0,
      vulnerabilitiesHigh: 0,
      vulnerabilitiesMedium: 0,
      vulnerabilitiesLow: 0,
      vulnerabilitiesStalePackages: 0,
      vulnerabilitiesRecent: 0,
    };

    let scorecardSum = 0;
    let scorecardCount = 0;
    let classificationCount = 0;
    let sbomCount = 0;
    let osvCount = 0;

    for (const entry of enriched) {
      totals.downloads += numberOrZero(entry.downloads);
      totals.users += numberOrZero(entry.users);
      totals.installs += numberOrZero(entry.installs);
      totals.activeInstalls += numberOrZero(entry.activeInstalls);

      const gh = entry.githubStats || {};
      totals.stars += numberOrZero(gh.stars);
      totals.forks += numberOrZero(gh.forks);
      totals.openIssues += numberOrZero(gh.openIssues);

      if (entry.scorecard && typeof entry.scorecard.score === 'number') {
        scorecardSum += entry.scorecard.score;
        scorecardCount += 1;
      }

      if (entry.classification && entry.classification.confidence !== null) {
        classificationCount += 1;
      }

      const dep = entry.dependencySummary || {};
      if (typeof dep.sbomPackageCount === 'number') {
        totals.dependencyPackages += dep.sbomPackageCount;
        totals.dependencyCount += numberOrZero(dep.sbomDependencyCount);
        sbomCount += 1;
      }

      const vuln = entry.vulnerabilitySummary || {};
      if (typeof vuln.total === 'number') {
        totals.vulnerabilitiesTotal += numberOrZero(vuln.total);
        totals.vulnerabilitiesUnique += numberOrZero(vuln.unique);
        totals.vulnerabilitiesCritical += numberOrZero(vuln.critical);
        totals.vulnerabilitiesHigh += numberOrZero(vuln.high);
        totals.vulnerabilitiesMedium += numberOrZero(vuln.medium);
        totals.vulnerabilitiesLow += numberOrZero(vuln.low);
        totals.vulnerabilitiesStalePackages += numberOrZero(vuln.stalePackages);
        totals.vulnerabilitiesRecent += numberOrZero(vuln.recentVulns);
        osvCount += 1;
      }
    }

    platformSummaries.push({
      platform,
      top100Count: enriched.length,
      totals,
      averages: {
        scorecard: scorecardCount ? scorecardSum / scorecardCount : null,
      },
      coverage: {
        classification: enriched.length ? classificationCount / enriched.length : null,
        scorecard: enriched.length ? scorecardCount / enriched.length : null,
        sbom: enriched.length ? sbomCount / enriched.length : null,
        osv: enriched.length ? osvCount / enriched.length : null,
      },
    });
  }

  const combinedSummary = {
    generatedAt: new Date().toISOString(),
    platforms: platformSummaries,
  };

  const combinedSummaryPath = path.join(PAPER_DIR, 'combined-summary.json');
  writeJson(combinedSummaryPath, combinedSummary);
  console.log(`Wrote ${combinedSummaryPath}`);

  console.log('Missing joins (sample):');
  for (const [key, list] of Object.entries(missing)) {
    const unique = Array.from(new Set(list));
    const sample = unique.slice(0, 10);
    console.log(`${key}: ${unique.length} missing`);
    if (sample.length) {
      console.log(`  sample: ${sample.join(', ')}`);
    }
  }
}

main();
