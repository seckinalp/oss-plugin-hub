import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const ANALYTICS_PATH = path.join(DATA_DIR, 'analytics-summary.json');

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

const METRICS = [
  'totalPluginsAll',
  'osTotalPlugins',
  'top100Count',
  'totalStars',
  'totalDownloads',
  'totalIssues',
  'totalForks',
  'avgStars',
  'avgDownloads',
  'issueDensity',
  'abandonmentRate',
  'starConcentrationIndex',
  'avgGovernanceScore',
  'avgWorkflowCount',
  'avgCoreTeamRatio',
  'ownerShare',
  'issueEfficiency',
  'avgProdDeps',
  'avgDevDeps',
  'avgStaleDepRatio',
  'avgRepoSizeKb',
  'avgCommitFrequency',
  'avgPrFrictionDays',
  'reposWithPrFriction',
  'starConcentration',
  'ossAvailabilityIndex',
  'downloadEntropy',
  'ownerCommitShare',
  'coreTeamRatio',
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

function getAnalyticsPlatformMap(analytics) {
  const map = new Map();
  if (!analytics || !Array.isArray(analytics.platforms)) return map;
  for (const entry of analytics.platforms) {
    if (entry && entry.platform) {
      map.set(entry.platform, entry);
    }
  }
  return map;
}

function main() {
  const analytics = readJson(ANALYTICS_PATH);
  if (!analytics) {
    console.error(`Missing analytics summary: ${ANALYTICS_PATH}`);
    process.exit(1);
  }

  const analyticsByPlatform = getAnalyticsPlatformMap(analytics);

  for (const platform of PLATFORMS) {
    const top100Path = path.join(DATA_DIR, platform, 'top100.json');
    const data = readJson(top100Path);
    if (!data || !Array.isArray(data.top100)) {
      console.warn(`Skipping ${platform}: missing top100.json`);
      continue;
    }

    const analyticsEntry = analyticsByPlatform.get(platform);
    if (!analyticsEntry) {
      console.warn(`Missing analytics entry for ${platform}`);
    }

    let added = 0;
    for (const entry of data.top100) {
      if (!entry.platformMetrics || typeof entry.platformMetrics !== 'object' || Array.isArray(entry.platformMetrics)) {
        entry.platformMetrics = {};
      }
      for (const metric of METRICS) {
        const existing = entry.platformMetrics[metric];
        if (existing !== undefined && existing !== null) continue;
        const value = analyticsEntry ? analyticsEntry[metric] : null;
        entry.platformMetrics[metric] = value !== undefined ? value : null;
        added += 1;
      }
    }

    writeJson(top100Path, data);
    console.log(`${platform}: added ${added} platformMetrics fields`);
  }
}

main();
