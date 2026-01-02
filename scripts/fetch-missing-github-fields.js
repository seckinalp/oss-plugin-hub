/**
 * Fetch missing GitHub fields for top100 plugins across platforms.
 * Targets only plugins where githubStats is missing key fields (commitActivity, topContributors, participation, workflows, governance).
 * Progress is persisted after each platform update.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ARGS = process.argv.slice(2);
const DATA_DIR = path.join(__dirname, '..', 'data');
const PLATFORMS = [
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
const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const argPlatform =
  ARGS.find((a) => a.startsWith('--platform='))?.split('=')[1] ||
  (ARGS.includes('--platform') ? ARGS[ARGS.indexOf('--platform') + 1] : null);
const TARGET_PLATFORMS = argPlatform
  ? argPlatform.split(',').map((p) => p.trim()).filter(Boolean)
  : PLATFORMS;
const argLimit = ARGS.find((a) => a.startsWith('--max='))?.split('=')[1] || null;
const parsedLimit = argLimit ? parseInt(argLimit, 10) : null;
const MAX_ITEMS = Number.isFinite(parsedLimit) ? parsedLimit : null;
const argDelay = ARGS.find((a) => a.startsWith('--delay-ms='))?.split('=')[1] || null;
const customDelay = argDelay ? parseInt(argDelay, 10) : null;
const DELAY_MS = Number.isFinite(customDelay) ? customDelay : GH_TOKEN ? 150 : 800;
const DRY_RUN = ARGS.includes('--dry-run');
let processedTotal = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRepo(repo) {
  if (!repo) return null;
  const clean = repo.replace(/^https?:\/\/github.com\//i, '').replace(/\.git$/i, '');
  const [owner, name] = clean.split('/');
  if (!owner || !name) return null;
  return { owner, repo: name };
}

function fetchGitHub(url, acceptHeader = 'application/vnd.github.v3+json') {
  const headers = {
    'User-Agent': 'oss-plugin-hub-missing-fields',
    Accept: acceptHeader,
  };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;

  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve({ status: res.statusCode, data: acceptHeader.includes('raw') ? data : JSON.parse(data) });
            } catch (err) {
              reject(err);
            }
          } else if (res.statusCode === 202 || res.statusCode === 404) {
            resolve({ status: res.statusCode, data: null });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function fetchCommitActivity(owner, repo) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchGitHub(`https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`);
    if (res.status === 202) {
      if (attempt === maxAttempts) return null;
      await delay(1500 * attempt);
      continue;
    }
    if (!res.data || !Array.isArray(res.data)) return null;
    const totalCommits = res.data.reduce((s, w) => s + w.total, 0);
    const commitFrequency = res.data.length > 0 ? Math.round(totalCommits / res.data.length) : 0;
    const recentActivity = res.data.slice(-4).map((w) => w.total);
    return { totalCommits, commitFrequency, recentActivity };
  }
  return null;
}

async function fetchContributors(owner, repo) {
  const res = await fetchGitHub(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`);
  if (!res.data || !Array.isArray(res.data)) return null;
  const contributors = res.data.map((c) => ({
    login: c.login,
    contributions: c.contributions,
    avatar_url: c.avatar_url,
    html_url: c.html_url,
  }));
  return { total: contributors.length, top: contributors.slice(0, 5) };
}

async function fetchParticipation(owner, repo) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchGitHub(`https://api.github.com/repos/${owner}/${repo}/stats/participation`);
    if (res.status === 202) {
      if (attempt === maxAttempts) return null;
      await delay(1500 * attempt);
      continue;
    }
    if (!res.data) return null;
    const all = res.data.all || [];
    const ownerArr = res.data.owner || [];
    const community = all.map((v, i) => v - (ownerArr[i] || 0));
    const ownerCommits = ownerArr.reduce((s, v) => s + v, 0);
    const totalCommits = all.reduce((s, v) => s + v, 0);
    const ownerPercentage = totalCommits > 0 ? (ownerCommits / totalCommits) * 100 : 0;
    return { allCommits: all, ownerCommits: ownerArr, communityCommits: community, ownerPercentage };
  }
  return null;
}

async function fetchWorkflows(owner, repo) {
  const res = await fetchGitHub(`https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows`);
  if (!res.data || !Array.isArray(res.data)) return { hasWorkflows: false, count: 0 };
  const files = res.data.filter((f) => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));
  return { hasWorkflows: files.length > 0, count: files.length };
}

async function fileExists(owner, repo, filePath) {
  try {
    const res = await fetchGitHub(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`);
    return !!res.data;
  } catch {
    return false;
  }
}

async function fetchGovernance(owner, repo) {
  const [hasContributing, hasCodeOfConduct, hasSecurity, hasLicense] = await Promise.all([
    fileExists(owner, repo, 'CONTRIBUTING.md').catch(() => fileExists(owner, repo, '.github/CONTRIBUTING.md')),
    fileExists(owner, repo, 'CODE_OF_CONDUCT.md').catch(() => fileExists(owner, repo, '.github/CODE_OF_CONDUCT.md')),
    fileExists(owner, repo, 'SECURITY.md').catch(() => fileExists(owner, repo, '.github/SECURITY.md')),
    fileExists(owner, repo, 'LICENSE').catch(() => fileExists(owner, repo, 'LICENSE.md')),
  ]);
  return {
    hasContributingGuide: !!hasContributing,
    hasCodeOfConduct: !!hasCodeOfConduct,
    hasSecurityPolicy: !!hasSecurity,
    hasLicense: !!hasLicense,
  };
}

function needsFetch(stats) {
  if (!stats) return true;
  if (!stats.commitActivity) return true;
  if (!stats.topContributors) return true;
  if (!stats.participation) return true;
  if (stats.workflowCount === undefined || stats.hasWorkflows === undefined) return true;
  if (!stats.governance) return true;
  return false;
}

function mergeStats(current, patch) {
  return { ...(current || {}), ...patch };
}

async function processPlatform(platform) {
  const pluginsPath = path.join(DATA_DIR, platform, 'plugins.json');
  const top100Path = path.join(DATA_DIR, platform, 'top100.json');
  if (!fs.existsSync(pluginsPath)) {
    console.log(`⚠️  ${platform}: plugins.json not found, skipping.`);
    return { updated: 0, skipped: 0, processed: 0 };
  }

  const pluginsData = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'));
  const plugins = pluginsData.plugins || [];
  const topSet = new Set(plugins.filter((p) => p.isTop100).map((p) => p.id));
  let updated = 0;
  let skipped = 0;
  let processed = 0;

  for (const plugin of plugins) {
    if (MAX_ITEMS !== null && processedTotal >= MAX_ITEMS) {
      break;
    }
    if (!topSet.has(plugin.id)) continue;
    if (!needsFetch(plugin.githubStats)) {
      skipped++;
      processed++;
      processedTotal++;
      continue;
    }

    const repoInfo = parseRepo(plugin.repo);
    if (!repoInfo) {
      skipped++;
      processed++;
      processedTotal++;
      continue;
    }

    if (DRY_RUN) {
      processed++;
      processedTotal++;
      continue;
    }

    try {
      const [contributors, commits, participation, workflows, governance] = await Promise.all([
        fetchContributors(repoInfo.owner, repoInfo.repo),
        fetchCommitActivity(repoInfo.owner, repoInfo.repo),
        fetchParticipation(repoInfo.owner, repoInfo.repo),
        fetchWorkflows(repoInfo.owner, repoInfo.repo),
        fetchGovernance(repoInfo.owner, repoInfo.repo),
      ]);

      const before = JSON.stringify(plugin.githubStats || {});
      const newStats = mergeStats(plugin.githubStats, {
        topContributors: contributors?.top,
        totalContributors: contributors?.total,
        commitActivity: commits || undefined,
        participation: participation || undefined,
        hasWorkflows: workflows?.hasWorkflows,
        workflowCount: workflows?.count,
        governance: governance || undefined,
      });

      const after = JSON.stringify(newStats);
      const changed = before !== after;
      if (changed) {
        plugin.githubStats = newStats;
        plugin.githubDataFetchedAt = new Date().toISOString();
        updated++;
      } else {
        skipped++;
      }
      await delay(DELAY_MS);
    } catch (err) {
      console.log(`⚠️  ${platform}/${plugin.id} fetch error: ${err.message}`);
    }
    processed++;
    processedTotal++;
  }

  if (!DRY_RUN) {
    fs.writeFileSync(pluginsPath, JSON.stringify({ plugins }, null, 2));
  }

  // Also inject githubStats into top100 entries for consistency
  if (!DRY_RUN && fs.existsSync(top100Path)) {
    const topData = JSON.parse(fs.readFileSync(top100Path, 'utf8'));
    const topList = topData.top100 || [];
    const map = new Map(plugins.map((p) => [p.id, p]));
    const newTop = topList.map((item) => {
      const full = map.get(item.id);
      return full && full.githubStats
        ? { ...item, githubStats: full.githubStats, githubDataFetchedAt: full.githubDataFetchedAt }
        : item;
    });
    fs.writeFileSync(top100Path, JSON.stringify({ ...topData, top100: newTop }, null, 2));
  }

  console.log(`✅ ${platform}: updated ${updated}, skipped ${skipped}, processed ${processed}`);
  return { updated, skipped, processed };
}

async function main() {
  console.log('▶️  Fetching missing GitHub fields for top100 plugins\n');
  if (DRY_RUN) {
    console.log('ℹ️  DRY RUN: no writes or GitHub fetches will occur.');
  }
  if (MAX_ITEMS !== null) {
    console.log(`ℹ️  Limit: will process at most ${MAX_ITEMS} plugins total.`);
  }
  console.log(`ℹ️  Platforms: ${TARGET_PLATFORMS.join(', ')}`);
  let remaining = MAX_ITEMS;
  for (const platform of TARGET_PLATFORMS) {
    const res = await processPlatform(platform);
    if (remaining !== null) {
      remaining = Math.max(0, remaining - res.processed);
      if (remaining === 0) break;
    }
  }
  console.log('\n🎉 Done. Updated plugins and top100 files saved.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
