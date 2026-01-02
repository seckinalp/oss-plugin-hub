import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATA_DIR = path.join(__dirname, '../data');
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
const SBOM_DIR = path.join(DATA_DIR, 'sbom');
const SBOM_INDEX_FILE = path.join(SBOM_DIR, 'index.json');

const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const FORCE_REFETCH = process.argv.includes('--force') || process.argv.includes('-f');
const PLATFORM_ARG =
  process.argv.find((arg) => arg.startsWith('--platform='))?.split('=')[1] ||
  (process.argv.includes('--platform') ? process.argv[process.argv.indexOf('--platform') + 1] : null);
const TARGET_PLATFORMS = PLATFORM_ARG ? PLATFORM_ARG.split(',').map((p) => p.trim()).filter(Boolean) : PLATFORMS;
const REQUEST_DELAY_MS = parseInt(process.env.SBOM_DELAY_MS || '150', 10); // soften rate limiting
const RATE_LIMIT_RETRY_MS = parseInt(process.env.SBOM_RETRY_MS || '4000', 10);

function ensureDirs() {
  fs.mkdirSync(SBOM_DIR, { recursive: true });
}

function log(...args) {
  console.log(...args);
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

function request(url) {
  const headers = {
    'User-Agent': 'oss-plugin-hub-sbom-fetcher',
    Accept: 'application/vnd.github+json',
  };
  if (GH_TOKEN) {
    headers.Authorization = `Bearer ${GH_TOKEN}`;
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body: data });
        });
      })
      .on('error', reject);
  });
}

async function fetchSbom(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/dependency-graph/sbom`;
  const res = await request(url);

  if (res.status === 200) {
    try {
      const parsed = JSON.parse(res.body);
      const sbom = parsed.sbom || parsed;
      return { status: 'ok', sbom };
    } catch (error) {
      return { status: 'error', message: `Failed to parse SBOM JSON: ${error.message}` };
    }
  }

  if (res.status === 404) {
    return { status: 'not_found', message: 'SBOM not found (404)' };
  }

  if (res.status === 429) {
    return { status: 'rate_limited', message: 'Rate limited (429)' };
  }

  if (res.status === 401 || res.status === 403) {
    return { status: 'forbidden', message: `Access denied (${res.status})` };
  }

  return { status: 'error', message: `HTTP ${res.status}` };
}

function loadTop100(platform) {
  const topPath = path.join(DATA_DIR, platform, 'top100.json');
  if (!fs.existsSync(topPath)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(topPath, 'utf8'));
  return { topPath, data };
}

function writeJson(file, payload) {
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
}

function loadIndex() {
  if (fs.existsSync(SBOM_INDEX_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SBOM_INDEX_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveIndex(index) {
  writeJson(SBOM_INDEX_FILE, index);
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  ensureDirs();

  if (!GH_TOKEN) {
    log('⚠️  No GH_TOKEN provided. SBOM endpoint usually requires authentication.');
  }

  log('📦 Fetching SBOMs for top100 plugins');
  log(`   Platforms: ${TARGET_PLATFORMS.join(', ')}`);
  if (FORCE_REFETCH) {
    log('   Mode: FORCE (re-download even if file exists)');
  }
  log('');

  const index = loadIndex();
  const repoCache = new Map();
  const summary = {
    processed: 0,
    fetched: 0,
    cached: 0,
    notFound: 0,
    forbidden: 0,
    errors: 0,
    rateLimited: 0,
    noRepo: 0,
  };

  for (const platform of TARGET_PLATFORMS) {
    const top = loadTop100(platform);
    if (!top) {
      log(`❌ Missing top100.json for ${platform}, skipping.`);
      continue;
    }

    log(`▶️  ${platform} (${top.data.top100?.length || 0} items)`);
    const plugins = top.data.top100 || [];

    for (const plugin of plugins) {
      summary.processed += 1;
      const repoInfo = parseRepo(plugin.repo);
      if (!repoInfo) {
        plugin.sbomStatus = 'no_repo';
        summary.noRepo += 1;
        continue;
      }

      const key = `${repoInfo.owner}/${repoInfo.repo}`;
      const fileName = `${repoInfo.owner}__${repoInfo.repo}.sbom.json`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(SBOM_DIR, fileName);
      const relativePath = normalizePath(path.relative(DATA_DIR, filePath));

      if (!FORCE_REFETCH && repoCache.has(key)) {
        const cached = repoCache.get(key);
        plugin.sbomPath = cached.sbomPath;
        plugin.sbomStatus = cached.sbomStatus;
        plugin.sbomFetchedAt = cached.sbomFetchedAt;
        if (cached.sbomError) {
          plugin.sbomError = cached.sbomError;
        }
        continue;
      }

      if (!FORCE_REFETCH && fs.existsSync(filePath) && index[key]?.status === 'ok') {
        const fetchedAt = index[key].fetchedAt || fs.statSync(filePath).mtime.toISOString();
        const cached = {
          sbomPath: relativePath,
          sbomStatus: 'cached',
          sbomFetchedAt: fetchedAt,
        };
        repoCache.set(key, cached);
        plugin.sbomPath = cached.sbomPath;
        plugin.sbomStatus = cached.sbomStatus;
        plugin.sbomFetchedAt = cached.sbomFetchedAt;
        summary.cached += 1;
        continue;
      }

      const result = await fetchSbom(repoInfo.owner, repoInfo.repo);
      const fetchedAt = new Date().toISOString();

      let finalResult = result;
      if (result.status === 'rate_limited') {
        await delay(RATE_LIMIT_RETRY_MS);
        finalResult = await fetchSbom(repoInfo.owner, repoInfo.repo);
      }

      if (finalResult.status === 'ok') {
        writeJson(filePath, finalResult.sbom);
        index[key] = { status: 'ok', path: relativePath, fetchedAt };
        summary.fetched += 1;
        plugin.sbomPath = relativePath;
        plugin.sbomStatus = 'ok';
        plugin.sbomFetchedAt = fetchedAt;
      } else {
        index[key] = { status: finalResult.status, fetchedAt };
        plugin.sbomStatus = finalResult.status;
        plugin.sbomFetchedAt = fetchedAt;
        if (finalResult.message) {
          plugin.sbomError = finalResult.message;
        }
        if (finalResult.status === 'not_found') {
          summary.notFound += 1;
        } else if (finalResult.status === 'forbidden') {
          summary.forbidden += 1;
        } else if (finalResult.status === 'rate_limited') {
          summary.rateLimited += 1;
        } else {
          summary.errors += 1;
        }
        log(`   ⚠️  ${key} -> ${finalResult.status}${finalResult.message ? ` (${finalResult.message})` : ''}`);
      }

      repoCache.set(key, {
        sbomPath: plugin.sbomPath,
        sbomStatus: plugin.sbomStatus,
        sbomFetchedAt: plugin.sbomFetchedAt,
        sbomError: plugin.sbomError,
      });

      if (REQUEST_DELAY_MS > 0) {
        await delay(REQUEST_DELAY_MS);
      }
    }

    writeJson(top.topPath, top.data);
    log(`   ✅ Saved ${platform}/top100.json`);
    log('');
  }

  saveIndex(index);

  log('Summary:');
  log(` - processed: ${summary.processed}`);
  log(` - fetched:   ${summary.fetched}`);
  log(` - cached:    ${summary.cached}`);
  log(` - notFound:  ${summary.notFound}`);
  log(` - forbidden: ${summary.forbidden}`);
  log(` - rateLimit: ${summary.rateLimited}`);
  log(` - errors:    ${summary.errors}`);
  log(` - noRepo:    ${summary.noRepo}`);
  log(`SBOM files stored in data/sbom (index at data/sbom/index.json)`);
}

main().catch((err) => {
  console.error('Fatal error while fetching SBOMs:', err);
  process.exit(1);
});
