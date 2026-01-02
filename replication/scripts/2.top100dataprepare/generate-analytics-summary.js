/**
 * Generate analytics summary JSON files (analytics-summary.json and analytics-summary2.json)
 * preserving the rich metric set while adding SBOM coverage.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OSV_SCANS_DIR = path.join(__dirname, '..', 'data', 'osv-scans');

const SUPPORTED_PLATFORMS = [
  'obsidian',
  'vscode',
  'firefox',
  'homeassistant',
  'wordpress',
  'jetbrains',
  'sublime',
  'minecraft',
  'chrome',
];

const PLATFORM_CATEGORIES = {
  vscode: 'IDE',
  jetbrains: 'IDE',
  sublime: 'IDE',
  chrome: 'Browser',
  firefox: 'Browser',
  minecraft: 'Gaming',
  wordpress: 'CMS',
  obsidian: 'Specialized',
  homeassistant: 'Specialized',
};

const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
// Static baseline counts sourced from legacy analytics-summary2 snapshot
// Format: platform -> { osTotalPlugins, totalPluginsAll }
const STATIC_COUNTS = {
  chrome: { osTotalPlugins: 7459, totalPluginsAll: 246379 },
  firefox: { osTotalPlugins: 7862, totalPluginsAll: 110320 },
  homeassistant: { osTotalPlugins: 2389, totalPluginsAll: 5187 },
  jetbrains: { osTotalPlugins: 5849, totalPluginsAll: 10003 },
  minecraft: { osTotalPlugins: 26089, totalPluginsAll: 98600 },
  obsidian: { osTotalPlugins: 2656, totalPluginsAll: 2656 },
  sublime: { osTotalPlugins: 4694, totalPluginsAll: 5581 },
  vscode: { osTotalPlugins: 25136, totalPluginsAll: 86145 },
  wordpress: { osTotalPlugins: 3986, totalPluginsAll: 59000 },
};

function getDataPath(platform, filename) {
  return path.join(__dirname, '..', 'data', platform, filename);
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
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
  const normalized = normalizeRepo(raw);
  return normalized ? normalized.toLowerCase() : null;
}

function loadOsvAnalysisMap() {
  const map = new Map();
  if (!fs.existsSync(OSV_SCANS_DIR)) return map;
  const files = fs.readdirSync(OSV_SCANS_DIR).filter((f) => f.endsWith('.analysis.json'));
  for (const file of files) {
    const data = readJson(path.join(OSV_SCANS_DIR, file));
    if (!data) continue;
    const repoFromFile = file.replace(/\.analysis\.json$/i, '').replace(/__/g, '/');
    const key = repoKey(repoFromFile);
    if (!key) continue;
    const summary = data.summary || {};
    const affectedPackages = summary.affectedPackages ?? 0;
    const staleUnique = Array.isArray(data.staleDependencies) ? data.staleDependencies.length : null;
    map.set(key, {
      affectedPackages,
      staleUnique,
    });
  }
  return map;
}

function getStars(p) {
  return p.githubStats?.stars ?? p.stars ?? 0;
}
function getForks(p) {
  return p.githubStats?.forks ?? p.forks ?? 0;
}
function getIssues(p) {
  return p.githubStats?.openIssues ?? p.openIssues ?? 0;
}
function getClosedIssues(p) {
  return p.githubStats?.closedIssues ?? p.closedIssues ?? 0;
}
function getDownloads(p) {
  return p.downloads ?? 0;
}
function getLanguage(p) {
  return p.githubStats?.language ?? p.language ?? 'Unknown';
}
function getLicense(p) {
  return p.githubStats?.license ?? p.license ?? 'No License';
}
function getTopics(p) {
  return p.githubStats?.topics ?? p.topics ?? [];
}
function getDepCounts(p) {
  const deps = p.githubStats?.dependencies || p.dependencies || {};
  const prod = deps.dependencies ? Object.keys(deps.dependencies).length : 0;
  const dev = deps.devDependencies ? Object.keys(deps.devDependencies).length : 0;
  return { prod, dev };
}
function getGovernanceScore(p) {
  const gov = p.githubStats?.governance;
  if (!gov) return 0;
  return (
    (gov.hasLicense ? 1 : 0) +
    (gov.hasCodeOfConduct ? 1 : 0) +
    (gov.hasSecurityPolicy ? 1 : 0) +
    (gov.hasContributingGuide ? 1 : 0)
  );
}
function getCoreTeamRatio(p) {
  const top = p.githubStats?.topContributors;
  const totalCommits = p.githubStats?.commitActivity?.totalCommits ?? 0;
  if (!top || !Array.isArray(top) || totalCommits === 0) return 0;
  const top3 = top.slice(0, 3).reduce((s, c) => s + (c.contributions || 0), 0);
  return top3 / totalCommits;
}
function getIssueEfficiency(p) {
  const open = getIssues(p);
  const closed = getClosedIssues(p);
  const total = open + closed;
  if (total === 0) return 0;
  return closed / total;
}
function isAbandoned(p) {
  const last = p.githubStats?.lastUpdated ?? p.lastUpdated;
  if (!last) return false;
  const diff = Date.now() - new Date(last).getTime();
  return diff > ONE_YEAR_MS;
}
function getOwnerShare(p) {
  return p.githubStats?.participation?.ownerPercentage ?? 0;
}
function getWorkflowCount(p) {
  return p.githubStats?.workflowCount ?? 0;
}
function getCommitFrequency(p) {
  return p.githubStats?.commitActivity?.commitFrequency ?? 0;
}
function getRepoSize(p) {
  return p.githubStats?.size ?? 0;
}
function getSbomStats(top100) {
  const stats = { total: top100.length, available: 0, notFound: 0, rateLimited: 0, errors: 0, missing: 0 };
  for (const p of top100) {
    const status = (p.sbomStatus || '').toLowerCase();
    if (status === 'ok' || status === 'cached') {
      stats.available++;
    } else if (status === 'not_found') {
      stats.notFound++;
    } else if (status === 'rate_limited') {
      stats.rateLimited++;
    } else if (status === 'forbidden' || status === 'error') {
      stats.errors++;
    } else if (status === 'no_repo' || !status) {
      stats.missing++;
    } else {
      stats.errors++;
    }
  }
  stats.coverage = stats.total > 0 ? stats.available / stats.total : 0;
  return stats;
}

function toTopList(countMap, total, limit = 10, keyName = 'name') {
  return Object.entries(countMap)
    .map(([name, count]) => ({
      [keyName]: name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function entropy(values) {
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;
  return values.reduce((h, v) => {
    if (v === 0) return h;
    const p = v / sum;
    return h - p * Math.log2(p);
  }, 0);
}

function loadPrFrictionMap() {
  const map = readJson(path.join(__dirname, '..', 'data', 'pr-friction-cache.json'), {});
  return map || {};
}

function getPrFrictionDays(repo, prMap) {
  const rec = prMap[repo];
  if (!rec || rec.status !== 'ok' || typeof rec.medianDays !== 'number') return null;
  return rec.medianDays;
}


function calculateDownloadConcentration(list) {
  const sorted = [...list].sort((a, b) => (getDownloads(b) - getDownloads(a)));
  const total = sorted.reduce((sum, p) => sum + getDownloads(p), 0);
  const sumFirst = (n) => sorted.slice(0, n).reduce((s, p) => s + getDownloads(p), 0);

  const top1 = sorted[0] || {};
  const top2 = sorted[1] || {};
  const top1Downloads = getDownloads(top1);
  const top2Downloads = getDownloads(top2);

  return {
    totalDownloads: total,
    top1: {
      name: top1.name || '',
      repo: top1.repo || '',
      downloads: top1Downloads,
      percentage: total > 0 ? (top1Downloads / total) * 100 : 0,
    },
    top2: {
      name: top2.name || '',
      repo: top2.repo || '',
      downloads: top2Downloads,
      percentage: total > 0 ? (top2Downloads / total) * 100 : 0,
    },
    top5Percentage: total > 0 ? (sumFirst(5) / total) * 100 : 0,
    top10Percentage: total > 0 ? (sumFirst(10) / total) * 100 : 0,
  };
}

async function generateAnalyticsSummary() {
  console.log('📊 Generating analytics summary with full metrics + SBOM...\n');

  const platformMetrics = [];
  const prMap = loadPrFrictionMap();
  const allTopPlugins = [];
  const osvAnalysisMap = loadOsvAnalysisMap();

  for (const platform of SUPPORTED_PLATFORMS) {
    const metadataPath = getDataPath(platform, 'metadata.json');
    const top100Path = getDataPath(platform, 'top100.json');

    const metadata = readJson(metadataPath, { totalCount: 0 });
    const top100Data = readJson(top100Path, { top100: [] });
    const top100 = Array.isArray(top100Data.top100) ? top100Data.top100 : [];

    const stars = top100.reduce((sum, p) => sum + getStars(p), 0);
    const downloads = top100.reduce((sum, p) => sum + getDownloads(p), 0);
    const issues = top100.reduce((sum, p) => sum + getIssues(p), 0);
    const forks = top100.reduce((sum, p) => sum + getForks(p), 0);
    const platformSize = metadata.totalCount || top100.length || 1;

    const languageCount = {};
    const licenseCount = {};
    const topicCount = {};
    let governanceSum = 0;
    let coreRatioSum = 0;
    let issueEfficiencySum = 0;
    let abandonmentCount = 0;
    let starConcentrationSum = 0;
    let ownerShareSum = 0;
    let prodDepSum = 0;
    let devDepSum = 0;
    let workflowSum = 0;
    let commitFreqSum = 0;
    let repoSizeSum = 0;
    let prFrictionSum = 0;
    let prFrictionCount = 0;
    let staleRatioSum = 0;
    let staleRatioCount = 0;
    const sbomStats = getSbomStats(top100);

    let top100WithDownloads = 0;
    let top100Downloads = 0;

    top100.forEach((p) => {
      const lang = getLanguage(p);
      languageCount[lang] = (languageCount[lang] || 0) + 1;
      const lic = getLicense(p);
      licenseCount[lic] = (licenseCount[lic] || 0) + 1;
      getTopics(p).forEach((t) => {
        topicCount[t] = (topicCount[t] || 0) + 1;
      });
      governanceSum += getGovernanceScore(p);
      coreRatioSum += getCoreTeamRatio(p);
      issueEfficiencySum += getIssueEfficiency(p);
      if (isAbandoned(p)) abandonmentCount += 1;
      starConcentrationSum += getStars(p) / Math.log10(platformSize || 1);
      ownerShareSum += getOwnerShare(p);
      const deps = getDepCounts(p);
      prodDepSum += deps.prod;
      devDepSum += deps.dev;
      workflowSum += getWorkflowCount(p);
      commitFreqSum += getCommitFrequency(p);
      repoSizeSum += getRepoSize(p);

      const repo = repoKey(p.repo);
      if (repo) {
        const osv = osvAnalysisMap.get(repo);
        if (osv && typeof osv.affectedPackages === 'number') {
          const affected = osv.affectedPackages;
          const staleUnique = typeof osv.staleUnique === 'number' ? osv.staleUnique : 0;
          const ratio = affected > 0 ? staleUnique / affected : 0;
          staleRatioSum += ratio;
          staleRatioCount += 1;
        }
      }

      const prDays = getPrFrictionDays(p.repo, prMap);
      if (prDays !== null) {
        prFrictionSum += prDays;
        prFrictionCount += 1;
      }

      if (getDownloads(p) > 0) {
        top100WithDownloads += 1;
        top100Downloads += getDownloads(p);
      }
    });

    allTopPlugins.push(...top100);
    const downloadConcentration = calculateDownloadConcentration(top100);

    const topLanguages = toTopList(languageCount, top100.length, 10, 'name');
    const topLicenses = toTopList(licenseCount, top100.length, 10, 'name');

    const staticCounts = STATIC_COUNTS[platform] || {};
    const osTotalPlugins = staticCounts.osTotalPlugins ?? metadata.totalCount ?? top100.length;
    const totalPluginsAll = staticCounts.totalPluginsAll ?? metadata.totalCount ?? top100.length;

    platformMetrics.push({
      platform,
      osTotalPlugins,
      totalPluginsAll,
      top100Count: top100.length,
      totalStars: stars,
      avgStars: top100.length > 0 ? stars / top100.length : 0,
      totalDownloads: downloads,
      avgDownloads: top100.length > 0 ? downloads / top100.length : 0,
      totalIssues: issues,
      avgIssues: top100.length > 0 ? issues / top100.length : 0,
      issueDensity: stars > 0 ? issues / stars : 0,
      totalForks: forks,
      avgForks: top100.length > 0 ? forks / top100.length : 0,
      category: PLATFORM_CATEGORIES[platform],
      top100WithDownloads,
      top100Downloads,
      avgGovernanceScore: top100.length > 0 ? governanceSum / top100.length : 0,
      avgCoreTeamRatio: top100.length > 0 ? coreRatioSum / top100.length : 0,
      issueEfficiency: top100.length > 0 ? issueEfficiencySum / top100.length : 0,
      abandonmentRate: top100.length > 0 ? abandonmentCount / top100.length : 0,
      starConcentration: top100.length > 0 ? starConcentrationSum / top100.length : 0,
      ownerShare: top100.length > 0 ? ownerShareSum / top100.length : 0,
      avgProdDeps: top100.length > 0 ? prodDepSum / top100.length : 0,
      avgDevDeps: top100.length > 0 ? devDepSum / top100.length : 0,
      avgWorkflowCount: top100.length > 0 ? workflowSum / top100.length : 0,
      avgCommitFrequency: top100.length > 0 ? commitFreqSum / top100.length : 0,
      avgRepoSize: top100.length > 0 ? repoSizeSum / top100.length : 0,
      avgStaleDepRatio: staleRatioCount > 0 ? staleRatioSum / staleRatioCount : 0,
      abandonedCount: abandonmentCount,
      avgRepoSizeKb: top100.length > 0 ? repoSizeSum / top100.length : 0,
      coreTeamRatio: top100.length > 0 ? (coreRatioSum / top100.length) * 100 : 0, // percent of commits by top3
      starConcentrationIndex: top100.length > 0 ? starConcentrationSum / top100.length : 0,
      ossAvailabilityIndex:
        top100.length > 0
          ? (governanceSum / top100.length) + (workflowSum / top100.length) + (issueEfficiencySum / top100.length) * 10
          : 0,
      topLanguages,
      topLicenses,
      avgPrFrictionDays: prFrictionCount > 0 ? prFrictionSum / prFrictionCount : 0,
      reposWithPrFriction: prFrictionCount,
      sbom: sbomStats,
      downloadConcentration,
    });

    const coveragePct = Math.round(sbomStats.coverage * 100);
    console.log(
      `✓ ${platform.padEnd(15)} - ${metadata.totalCount.toLocaleString().padStart(6)} plugins, SBOM ${coveragePct}%`,
    );
  }

  // Aggregate metrics
  const totalPlugins = platformMetrics.reduce((sum, p) => sum + p.osTotalPlugins, 0);
  const totalPluginsAll = platformMetrics.reduce((sum, p) => sum + p.totalPluginsAll, 0);
  const totalStars = platformMetrics.reduce((sum, p) => sum + p.totalStars, 0);
  const totalDownloads = platformMetrics.reduce((sum, p) => sum + p.totalDownloads, 0);
  const totalIssues = platformMetrics.reduce((sum, p) => sum + p.totalIssues, 0);
  const totalForks = platformMetrics.reduce((sum, p) => sum + p.totalForks, 0);
  const totalTop100 = platformMetrics.reduce((sum, p) => sum + p.top100Count, 0);
  const top100TotalDownloads = platformMetrics.reduce((sum, p) => sum + p.top100Downloads, 0);

  const totalSbom = platformMetrics.reduce((sum, p) => sum + (p.sbom?.total || 0), 0);
  const totalSbomAvailable = platformMetrics.reduce((sum, p) => sum + (p.sbom?.available || 0), 0);
  const totalSbomNotFound = platformMetrics.reduce((sum, p) => sum + (p.sbom?.notFound || 0), 0);
  const totalSbomErrors = platformMetrics.reduce((sum, p) => sum + (p.sbom?.errors || 0), 0);
  const totalSbomRateLimited = platformMetrics.reduce((sum, p) => sum + (p.sbom?.rateLimited || 0), 0);
  const totalSbomMissing = platformMetrics.reduce((sum, p) => sum + (p.sbom?.missing || 0), 0);

  const aggregateDownloadConcentration = calculateDownloadConcentration(allTopPlugins);

  const aggregate = {
    osTotalPlugins: totalPlugins,
    totalPluginsAll,
    totalTop100,
    top100TotalDownloads,
    totalStars,
    totalDownloads,
    totalIssues,
    totalForks,
    avgStarsPerPlugin: totalTop100 > 0 ? totalStars / totalTop100 : 0,
    avgDownloadsPerPlugin: totalTop100 > 0 ? totalDownloads / totalTop100 : 0,
    platformCount: SUPPORTED_PLATFORMS.length,
    sbom: {
      total: totalSbom,
      available: totalSbomAvailable,
      coverage: totalSbom > 0 ? totalSbomAvailable / totalSbom : 0,
      notFound: totalSbomNotFound,
      errors: totalSbomErrors,
      rateLimited: totalSbomRateLimited,
      missing: totalSbomMissing,
    },
    downloadConcentration: aggregateDownloadConcentration,
  };

  // Overview metrics (high-level summary)
  const overview = {
    platforms: SUPPORTED_PLATFORMS.length,
    topPlugins: totalTop100,
    totalStars,
    totalDownloads,
    totalIssues,
    totalForks,
    avgStarsPerPlugin: aggregate.avgStarsPerPlugin,
    avgDownloadsPerPlugin: aggregate.avgDownloadsPerPlugin,
    avgRepoSizeKb:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.avgRepoSize, 0) / platformMetrics.length
        : 0,
    avgWorkflowCount:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.avgWorkflowCount, 0) / platformMetrics.length
        : 0,
    avgGovernanceScore:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.avgGovernanceScore, 0) / platformMetrics.length
        : 0,
  };

  // Research metrics (rolled-up averages)
  const researchMetrics = {
    avgGovernanceScore: overview.avgGovernanceScore,
    avgCoreTeamRatio:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.avgCoreTeamRatio, 0) / platformMetrics.length
        : 0,
    issueEfficiency:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.issueEfficiency, 0) / platformMetrics.length
        : 0,
    abandonmentRate:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.abandonmentRate, 0) / platformMetrics.length
        : 0,
    starConcentration:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.starConcentration, 0) / platformMetrics.length
        : 0,
    ownerCommitShare:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.ownerShare, 0) / platformMetrics.length
        : 0,
    avgProdDeps:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.avgProdDeps, 0) / platformMetrics.length
        : 0,
    avgDevDeps:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.avgDevDeps, 0) / platformMetrics.length
        : 0,
    avgWorkflowCount: overview.avgWorkflowCount,
    avgCommitFrequency:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.avgCommitFrequency, 0) / platformMetrics.length
        : 0,
    avgRepoSizeKb: overview.avgRepoSizeKb,
    avgStaleDepRatio:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + p.avgStaleDepRatio, 0) / platformMetrics.length
        : 0,
    downloadEntropy: entropy(platformMetrics.map((p) => p.top100Downloads)),
    avgPrFrictionDays:
      platformMetrics.length > 0
        ? platformMetrics.reduce((s, p) => s + (p.avgPrFrictionDays || 0), 0) / platformMetrics.length
        : 0,
  };

  // Distribution metrics across all top100s
  const languageTotalCount = {};
  const licenseTotalCount = {};
  const topicTotalCount = {};
  platformMetrics.forEach((p) => {
    p.topLanguages.forEach((l) => {
      languageTotalCount[l.name] = (languageTotalCount[l.name] || 0) + l.count;
    });
    p.topLicenses.forEach((l) => {
      licenseTotalCount[l.name] = (licenseTotalCount[l.name] || 0) + l.count;
    });
    const top100 = readJson(getDataPath(p.platform, 'top100.json'), { top100: [] }).top100 || [];
    top100.forEach((item) => {
      getTopics(item).forEach((t) => {
        topicTotalCount[t] = (topicTotalCount[t] || 0) + 1;
      });
    });
  });
  const distribution = {
    topLanguages: toTopList(languageTotalCount, totalTop100, 10, 'language'),
    topLicenses: toTopList(licenseTotalCount, totalTop100, 10, 'license'),
    topTopics: toTopList(topicTotalCount, totalTop100, 10, 'topic'),
  };

  const insights = {};

  const summary = {
    generatedAt: new Date().toISOString(),
    platforms: platformMetrics.sort((a, b) => b.avgStars - a.avgStars),
    aggregate,
    overview,
    researchMetrics,
    distribution,
    insights,
  };

  const outputPath1 = path.join(__dirname, '..', 'data', 'analytics-summary.json');
  const outputPath2 = path.join(__dirname, '..', 'data', 'analytics-summary2.json');
  fs.writeFileSync(outputPath1, JSON.stringify(summary, null, 2));
  fs.writeFileSync(outputPath2, JSON.stringify(summary, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('📊 AGGREGATE STATISTICS');
  console.log('='.repeat(70));
  console.log(`Total plugins:          ${aggregate.osTotalPlugins.toLocaleString()}`);
  console.log(`Total top 100:          ${aggregate.totalTop100}`);
  console.log(`Total GitHub stars:     ${aggregate.totalStars.toLocaleString()}`);
  console.log(`Total downloads:        ${aggregate.totalDownloads.toLocaleString()}`);
  console.log(`SBOM coverage:          ${(aggregate.sbom.coverage * 100).toFixed(1)}%`);
  console.log('\n✅ Analytics summaries saved to:');
  console.log(`   - data/analytics-summary.json`);
  console.log(`   - data/analytics-summary2.json\n`);
}

generateAnalyticsSummary().catch(console.error);
