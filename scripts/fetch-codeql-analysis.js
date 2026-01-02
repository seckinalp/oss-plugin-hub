import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATA_DIR = path.join(__dirname, '../data');
const CACHE_FILE = path.join(DATA_DIR, 'codeql-analysis-cache.json');
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

const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const FORCE_REFETCH = process.argv.includes('--force') || process.argv.includes('-f');
const PLATFORM_ARG =
  process.argv.find((arg) => arg.startsWith('--platform='))?.split('=')[1] ||
  (process.argv.includes('--platform') ? process.argv[process.argv.indexOf('--platform') + 1] : null);
const TARGET_PLATFORMS = PLATFORM_ARG
  ? PLATFORM_ARG.split(',').map((p) => p.trim()).filter(Boolean)
  : PLATFORMS;

const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = (() => {
  if (LIMIT_ARG) {
    const v = parseInt(LIMIT_ARG.split('=')[1], 10);
    return Number.isFinite(v) ? v : null;
  }
  const idx = process.argv.indexOf('--limit');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const v = parseInt(process.argv[idx + 1], 10);
    return Number.isFinite(v) ? v : null;
  }
  return null;
})();

const DELAY_MS = parseInt(process.env.CODEQL_DELAY_MS || '200', 10);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRepo(repo) {
  if (!repo) return null;
  let value = repo.trim();
  value = value.replace(/^https?:\/\/github.com\//i, '').replace(/\.git$/i, '');
  const parts = value.split('/');
  if (parts.length < 2) return null;
  const owner = parts[0];
  const name = parts[1];
  if (!owner || !name) return null;
  return { owner, repo: name };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  return readJson(CACHE_FILE, {});
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function loadTop100(platform) {
  const topPath = path.join(DATA_DIR, platform, 'top100.json');
  if (!fs.existsSync(topPath)) return null;
  const data = readJson(topPath, { top100: [] });
  const top100 = Array.isArray(data.top100) ? data.top100 : [];
  return { topPath, data, top100 };
}

function githubGet(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'oss-plugin-hub/codeql-fetcher',
      Accept: 'application/vnd.github+json',
    };
    if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;

    https
      .get(url, { headers }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve({ status: 200, data: JSON.parse(body) });
            } catch (err) {
              reject(new Error(`Failed to parse JSON (${res.statusCode})`));
            }
          } else if (res.statusCode === 404) {
            resolve({ status: 404, data: null });
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error(`Auth/rate limit error (${res.statusCode})`));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function fetchCodeqlSummary(owner, repo) {
  const base = `https://api.github.com/repos/${owner}/${repo}/code-scanning/alerts?tool_name=CodeQL&per_page=100`;
  const res = await githubGet(base);
  const fetchedAt = new Date().toISOString();

  if (res.status === 404) {
    return { status: 'not_found', fetchedAt };
  }

  if (res.status !== 200 || !Array.isArray(res.data)) {
    return { status: 'error', error: 'unexpected_response', fetchedAt };
  }

  const alerts = res.data;
  const bySeverity = alerts.reduce(
    (acc, a) => {
      const sev = (a.rule?.severity || a.rule?.security_severity_level || 'unknown').toLowerCase();
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    },
    {}
  );
  const mostRecent = alerts
    .map((a) => a.most_recent_instance?.last_seen_at || a.created_at)
    .filter(Boolean)
    .sort()
    .pop();

  return {
    status: 'ok',
    fetchedAt,
    alertCount: alerts.length,
    severity: bySeverity,
    lastSeenAt: mostRecent || null,
  };
}

function applyToPlugin(plugin, result) {
  plugin.codeqlStatus = result.status;
  plugin.codeqlFetchedAt = result.fetchedAt || new Date().toISOString();
  if (result.status === 'ok') {
    plugin.codeqlAlertCount = result.alertCount;
    plugin.codeqlSeverity = result.severity || {};
    plugin.codeqlLastSeenAt = result.lastSeenAt || null;
    if (plugin.codeqlError) delete plugin.codeqlError;
  } else {
    plugin.codeqlAlertCount = null;
    plugin.codeqlSeverity = null;
    plugin.codeqlLastSeenAt = null;
    if (result.error) plugin.codeqlError = result.error;
  }
}

async function processPlatform(platform, cache, counters) {
  const top = loadTop100(platform);
  if (!top) {
    console.log(`- ${platform}: top100.json not found, skipping.`);
    return { processed: 0, fetched: 0, cached: 0, errors: 0, notFound: 0, noRepo: 0 };
  }

  const stats = { processed: 0, fetched: 0, cached: 0, errors: 0, notFound: 0, noRepo: 0 };

  for (const plugin of top.top100) {
    stats.processed += 1;
    if (LIMIT !== null && stats.processed > LIMIT) {
      stats.processed -= 1;
      break;
    }

    const repoInfo = parseRepo(plugin.repo);
    if (!repoInfo) {
      stats.noRepo += 1;
      applyToPlugin(plugin, { status: 'no_repo', fetchedAt: new Date().toISOString(), error: 'missing repo' });
      continue;
    }
    const slug = `${repoInfo.owner}/${repoInfo.repo}`;

    let result = cache[slug];
    if (result && !FORCE_REFETCH) {
      stats.cached += 1;
    } else {
      try {
        result = await fetchCodeqlSummary(repoInfo.owner, repoInfo.repo);
        cache[slug] = result;
        saveCache(cache);
        if (result.status === 'ok') stats.fetched += 1;
        else if (result.status === 'not_found') stats.notFound += 1;
        else stats.errors += 1;
        if (DELAY_MS > 0) await delay(DELAY_MS);
      } catch (err) {
        stats.errors += 1;
        result = { status: 'error', error: err.message, fetchedAt: new Date().toISOString() };
      }
    }

    applyToPlugin(plugin, result);
  }

  fs.writeFileSync(top.topPath, JSON.stringify(top.data, null, 2));
  console.log(
    `- ${platform}: processed ${stats.processed}, fetched ${stats.fetched}, cached ${stats.cached}, errors ${stats.errors}, missing repo ${stats.noRepo}`
  );
  return stats;
}

async function main() {
  console.log('Fetching GitHub CodeQL analysis summary for top100 plugins');
  console.log(`Platforms: ${TARGET_PLATFORMS.join(', ')}`);
  if (FORCE_REFETCH) console.log('Mode: FORCE (re-fetch even if cached)');
  if (LIMIT !== null) console.log(`Limit per platform: ${LIMIT}`);
  console.log('');

  if (!GH_TOKEN) {
    console.log('⚠️  No GH_TOKEN set; code scanning endpoints may fail or be rate-limited.');
  }

  const cache = loadCache();
  const totals = { processed: 0, fetched: 0, cached: 0, errors: 0, notFound: 0, noRepo: 0 };

  for (const platform of TARGET_PLATFORMS) {
    const stats = await processPlatform(platform, cache, totals);
    totals.processed += stats.processed;
    totals.fetched += stats.fetched;
    totals.cached += stats.cached;
    totals.errors += stats.errors;
    totals.notFound += stats.notFound;
    totals.noRepo += stats.noRepo;
  }

  saveCache(cache);

  console.log('\nSummary:');
  console.log(`  Processed: ${totals.processed}`);
  console.log(`  Fetched:   ${totals.fetched}`);
  console.log(`  Cached:    ${totals.cached}`);
  console.log(`  Not found: ${totals.notFound}`);
  console.log(`  Errors:    ${totals.errors}`);
  console.log(`  No repo:   ${totals.noRepo}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
