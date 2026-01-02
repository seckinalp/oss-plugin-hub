/**
 * Download README files for top100 plugins across platforms.
 * Uses inline README content when present, otherwise fetches from GitHub.
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
const DEFAULT_OUT_DIR = path.join(DATA_DIR, 'readmes');
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

function getArgValue(flag) {
  const direct = ARGS.find((arg) => arg.startsWith(`${flag}=`));
  if (direct) return direct.split('=').slice(1).join('=');
  const idx = ARGS.indexOf(flag);
  if (idx !== -1 && idx + 1 < ARGS.length) return ARGS[idx + 1];
  return null;
}

const argPlatform = getArgValue('--platform');
const TARGET_PLATFORMS = argPlatform
  ? argPlatform.split(',').map((p) => p.trim()).filter(Boolean)
  : PLATFORMS;
const argOutDir = getArgValue('--out');
const OUT_DIR = argOutDir ? path.resolve(argOutDir) : DEFAULT_OUT_DIR;
const argLimit = getArgValue('--max');
const parsedLimit = argLimit ? parseInt(argLimit, 10) : null;
const MAX_ITEMS = Number.isFinite(parsedLimit) ? parsedLimit : null;
const argConcurrency = getArgValue('--concurrency');
const parsedConcurrency = argConcurrency ? parseInt(argConcurrency, 10) : null;
const DEFAULT_CONCURRENCY = GH_TOKEN ? 6 : 2;
const CONCURRENCY = Number.isFinite(parsedConcurrency) ? parsedConcurrency : DEFAULT_CONCURRENCY;
const argReport = getArgValue('--report');
const REPORT_PATH = argReport ? path.resolve(argReport) : null;
const REPO_FALLBACK = ARGS.includes('--fallback-repo');
const FORCE = ARGS.includes('--force');
const PREFER_REMOTE = ARGS.includes('--prefer-remote');
const DRY_RUN = ARGS.includes('--dry-run');

function toRawGitHubUrl(htmlUrl) {
  if (!htmlUrl || typeof htmlUrl !== 'string') return null;
  const match = htmlUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
  );
  if (!match) return null;
  const [, owner, repo, branch, filePath] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}

function pickReadmeRemote(readmeObj) {
  if (!readmeObj || typeof readmeObj !== 'object') return null;
  if (readmeObj.download_url) return { url: readmeObj.download_url, acceptRaw: false };
  if (readmeObj.url) return { url: readmeObj.url, acceptRaw: true };
  if (readmeObj.html_url) {
    const raw = toRawGitHubUrl(readmeObj.html_url);
    if (raw) return { url: raw, acceptRaw: false };
  }
  return null;
}

function parseRepo(repo) {
  if (!repo) return null;
  const clean = String(repo)
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

function getReadmeSource(item) {
  const readmeValue = item?.githubStats?.readme;
  const readmeObj = readmeValue && typeof readmeValue === 'object' ? readmeValue : null;
  const inline = typeof readmeValue === 'string' ? readmeValue : null;
  const communityReadme = item?.githubStats?.communityProfile?.files?.readme || null;

  const remote =
    pickReadmeRemote(readmeObj) || pickReadmeRemote(communityReadme);

  if (PREFER_REMOTE && remote) return { kind: 'remote', ...remote };
  if (!PREFER_REMOTE && inline && inline.trim()) return { kind: 'inline', content: inline };
  if (remote) return { kind: 'remote', ...remote };
  if (inline && inline.trim()) return { kind: 'inline', content: inline };
  return null;
}

function extractExtension(value) {
  if (!value) return null;
  const text = String(value);
  const clean = text.split('?')[0];
  const name = clean.split('/').pop() || '';
  const ext = path.extname(name);
  if (ext && ext.length <= 12) return ext;
  return null;
}

function getReadmeExtension(item) {
  const readmeValue = item?.githubStats?.readme;
  const readmeObj = readmeValue && typeof readmeValue === 'object' ? readmeValue : null;
  const communityReadme = item?.githubStats?.communityProfile?.files?.readme || null;
  const candidates = [];

  if (readmeObj?.path) candidates.push(readmeObj.path);
  if (readmeObj?.download_url) candidates.push(readmeObj.download_url);
  if (readmeObj?.html_url) candidates.push(readmeObj.html_url);
  if (readmeObj?.url) candidates.push(readmeObj.url);
  if (communityReadme?.html_url) candidates.push(communityReadme.html_url);
  if (communityReadme?.url) candidates.push(communityReadme.url);

  for (const candidate of candidates) {
    const ext = extractExtension(candidate);
    if (ext) return ext;
  }
  return '.md';
}

function sanitizeName(value) {
  if (!value) return '';
  return String(value)
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getOutputPath(platform, item, index) {
  const baseCandidate =
    item?.repo ||
    item?.slug ||
    item?.id ||
    item?.name ||
    `plugin-${index + 1}`;
  const safeBase = sanitizeName(baseCandidate) || `plugin-${index + 1}`;
  const extension = getReadmeExtension(item);
  return path.join(OUT_DIR, platform, `${safeBase}${extension}`);
}

async function fetchReadmeFromRepo(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  return fetchText(url, true);
}

function fetchText(url, acceptRaw) {
  const headers = {
    'User-Agent': 'oss-plugin-hub-readmes',
    Accept: acceptRaw ? 'application/vnd.github.raw' : 'text/plain',
  };
  if (GH_TOKEN && url.startsWith('https://api.github.com/')) {
    headers.Authorization = `Bearer ${GH_TOKEN}`;
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          resolve(fetchText(res.headers.location, acceptRaw));
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else if (res.statusCode === 404) {
            resolve(null);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function runWithLimit(items, limit, worker) {
  let idx = 0;
  async function next() {
    const current = idx++;
    if (current >= items.length) return;
    await worker(items[current], current);
    return next();
  }
  const slots = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: slots }, () => next());
  await Promise.all(runners);
}

function getItemLabel(item, index) {
  return (
    item?.repo ||
    item?.slug ||
    item?.id ||
    item?.name ||
    `plugin-${index + 1}`
  );
}

async function processPlatform(platform, report) {
  const inputPath = path.join(DATA_DIR, platform, 'top100.json');
  if (!fs.existsSync(inputPath)) {
    console.warn(`Missing ${inputPath}`);
    return { saved: 0, skipped: 0, errors: 0 };
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const items = Array.isArray(data.top100) ? data.top100 : [];
  const targets = MAX_ITEMS ? items.slice(0, MAX_ITEMS) : items;
  const outDir = path.join(OUT_DIR, platform);
  fs.mkdirSync(outDir, { recursive: true });

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  await runWithLimit(targets, CONCURRENCY, async (item, index) => {
    const label = getItemLabel(item, index);
    const source = getReadmeSource(item);
    if (!source) {
      let fallbackContent = null;
      if (REPO_FALLBACK) {
        const repoInfo = parseRepo(item?.repo);
        if (repoInfo) {
          fallbackContent = await fetchReadmeFromRepo(repoInfo.owner, repoInfo.repo);
        }
      }

      if (fallbackContent && fallbackContent.trim()) {
        const outPath = getOutputPath(platform, item, index);
        if (!FORCE && fs.existsSync(outPath)) {
          skipped += 1;
          if (report) {
            report.push({
              platform,
              label,
              repo: item?.repo || null,
              slug: item?.slug || null,
              reason: 'exists',
              outputPath: outPath,
            });
          }
          return;
        }
        if (!DRY_RUN) {
          fs.writeFileSync(outPath, fallbackContent, 'utf-8');
        }
        saved += 1;
        return;
      }

      skipped += 1;
      if (report) {
        report.push({
          platform,
          label,
          repo: item?.repo || null,
          slug: item?.slug || null,
          reason: fallbackContent === null ? 'missing_source' : 'fallback_empty',
        });
      }
      return;
    }

    const outPath = getOutputPath(platform, item, index);
    if (!FORCE && fs.existsSync(outPath)) {
      skipped += 1;
      if (report) {
        report.push({
          platform,
          label,
          repo: item?.repo || null,
          slug: item?.slug || null,
          reason: 'exists',
          outputPath: outPath,
        });
      }
      return;
    }

    try {
      let content = null;
      if (source.kind === 'inline') {
        content = source.content;
      } else {
        content = await fetchText(source.url, source.acceptRaw);
        if (content === null) {
          skipped += 1;
          if (report) {
            report.push({
              platform,
              label,
              repo: item?.repo || null,
              slug: item?.slug || null,
              reason: 'remote_not_found',
              url: source.url,
            });
          }
          return;
        }
      }

      if (!content || !content.trim()) {
        skipped += 1;
        if (report) {
          report.push({
            platform,
            label,
            repo: item?.repo || null,
            slug: item?.slug || null,
            reason: 'empty_content',
            source: source.kind,
          });
        }
        return;
      }

      if (!DRY_RUN) {
        fs.writeFileSync(outPath, content, 'utf-8');
      }
      saved += 1;
    } catch (err) {
      errors += 1;
      console.warn(`Failed ${platform} ${label}: ${err.message}`);
    }
  });

  return { saved, skipped, errors };
}

async function main() {
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const report = REPORT_PATH ? [] : null;

  for (const platform of TARGET_PLATFORMS) {
    const res = await processPlatform(platform, report);
    totalSaved += res.saved;
    totalSkipped += res.skipped;
    totalErrors += res.errors;
    console.log(
      `${platform}: saved ${res.saved}, skipped ${res.skipped}, errors ${res.errors}`
    );
  }

  console.log(
    `Total: saved ${totalSaved}, skipped ${totalSkipped}, errors ${totalErrors}`
  );

  if (report) {
    const summary = report.reduce((acc, entry) => {
      acc[entry.reason] = (acc[entry.reason] || 0) + 1;
      return acc;
    }, {});
    const payload = {
      generatedAt: new Date().toISOString(),
      total: report.length,
      summary,
      items: report,
    };
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`Report written to ${REPORT_PATH}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
