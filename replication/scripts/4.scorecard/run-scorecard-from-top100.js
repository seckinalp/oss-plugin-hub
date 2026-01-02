#!/usr/bin/env node

/**
 * OpenSSF Scorecard runner for top100.json repos (Node.js).
 * Runs Scorecard via Docker and stores JSON in scorecard-local.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const HELP = hasFlag(args, 'help') || hasFlag(args, 'h');

if (HELP) {
  printUsage();
  process.exit(0);
}

const LIMIT = parseNumberArg(args, 'limit') || 0;
const DELAY = parseNumberArg(args, 'delay') || 0;
const PLATFORM_ARG = getArgValue(args, 'platform');
const PLATFORMS_FILTER = PLATFORM_ARG
  ? PLATFORM_ARG.split(',').map((p) => p.trim()).filter(Boolean)
  : null;
const SKIP_EXISTING = hasFlag(args, 'skip-existing') || hasFlag(args, 'skipexisting');
const RESUME = hasFlag(args, 'resume');
const FORCE = hasFlag(args, 'force');
const IMAGE = getArgValue(args, 'image') || process.env.SCORECARD_IMAGE || 'gcr.io/openssf/scorecard:stable';
const PULL = hasFlag(args, 'pull');

const GITHUB_TOKEN = process.env.GITHUB_AUTH_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const PROJECT_ROOT = findProjectRoot(__dirname);
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const PLATFORM_ROOT = fs.existsSync(path.join(DATA_DIR, 'platforms'))
  ? path.join(DATA_DIR, 'platforms')
  : DATA_DIR;
const SCORECARD_DIR = fs.existsSync(path.join(DATA_DIR, 'scorecard'))
  ? path.join(DATA_DIR, 'scorecard', 'scorecard-local')
  : path.join(PROJECT_ROOT, 'scorecard-local');
const LOG_FILE = path.join(PROJECT_ROOT, 'scorecard-scan-top100.log');
const PROGRESS_FILE = path.join(PROJECT_ROOT, '.scorecard-progress-top100');

const ALL_PLATFORMS = [
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

if (!GITHUB_TOKEN) {
  log('GITHUB_AUTH_TOKEN (or GITHUB_TOKEN) is not set.', 'ERROR');
  log('Set it before running: $env:GITHUB_AUTH_TOKEN=\"ghp_...\"', 'ERROR');
  process.exit(1);
}

ensureDir(SCORECARD_DIR);

if (!checkDocker()) {
  log('Docker is not available or not running.', 'ERROR');
  process.exit(1);
}

log('=== OpenSSF Scorecard Runner - Top100 ===', 'INFO');
log(`Project: ${PROJECT_ROOT}`, 'INFO');
log(`Data: ${DATA_DIR}`, 'INFO');
log(`Platforms: ${PLATFORMS_FILTER ? PLATFORMS_FILTER.join(', ') : ALL_PLATFORMS.join(', ')}`, 'INFO');
log(`Output: ${SCORECARD_DIR}`, 'INFO');
log(`Image: ${IMAGE}`, 'INFO');
log(`Delay: ${DELAY}s`, 'INFO');
if (LIMIT > 0) log(`Limit: ${LIMIT}`, 'INFO');
if (SKIP_EXISTING) log('Mode: skip existing files', 'INFO');
if (RESUME) log('Mode: resume from progress file', 'INFO');
if (FORCE) log('Mode: force overwrite', 'INFO');

if (PULL) {
  log('Pulling scorecard image...', 'INFO');
  const pull = spawnSync('docker', ['pull', IMAGE], { encoding: 'utf8' });
  if (pull.status !== 0) {
    log(`Failed to pull image: ${pull.stderr || pull.stdout}`.trim(), 'WARN');
  } else {
    log('Image ready.', 'INFO');
  }
}

const repos = collectRepos(PLATFORMS_FILTER);
if (repos.length === 0) {
  log('No repositories found to process.', 'WARN');
  process.exit(0);
}

const processedSet = RESUME ? loadProcessed(PROGRESS_FILE) : new Set();

let processed = 0;
let success = 0;
let failed = 0;
let skipped = 0;

const total = repos.length;
const startTime = Date.now();

for (let i = 0; i < repos.length; i++) {
  const item = repos[i];
  const count = i + 1;

  if (LIMIT > 0 && count > LIMIT) {
    log(`Reached limit of ${LIMIT} repositories.`, 'INFO');
    break;
  }

  if (RESUME && processedSet.has(item.repo)) {
    skipped += 1;
    continue;
  }

  const outputFile = getOutputFilename(SCORECARD_DIR, item.repo);
  if (SKIP_EXISTING && !FORCE && fs.existsSync(outputFile)) {
    if (isValidScorecardFile(outputFile)) {
      skipped += 1;
      addProcessed(PROGRESS_FILE, item.repo);
      continue;
    }
  }

  log(`Progress: ${count}/${total} - ${item.repo}`, 'INFO');
  const ok = runScorecard(item.repo, outputFile);
  addProcessed(PROGRESS_FILE, item.repo);

  if (ok) {
    success += 1;
  } else {
    failed += 1;
  }
  processed += 1;

  if (DELAY > 0 && count < total) {
    sleep(DELAY * 1000);
  }
}

const durationMs = Date.now() - startTime;
const duration = formatDuration(durationMs);

log('=== Summary ===', 'INFO');
log(`Total repositories: ${total}`, 'INFO');
log(`Processed: ${processed}`, 'INFO');
log(`Successful: ${success}`, 'INFO');
log(`Failed: ${failed}`, 'INFO');
log(`Skipped: ${skipped}`, 'INFO');
log(`Duration: ${duration}`, 'INFO');

function printUsage() {
  console.log('Usage: node run-scorecard-from-top100.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --platform NAME    Process only specific platform (comma-separated ok)');
  console.log('  --skip-existing    Skip repositories with existing output files');
  console.log('  --resume           Resume from progress file');
  console.log('  --force            Overwrite existing files');
  console.log('  --limit N          Process only the first N repositories');
  console.log('  --delay N          Delay N seconds between requests');
  console.log('  --image NAME       Docker image (default: gcr.io/openssf/scorecard:stable)');
  console.log('  --pull             Pull the Docker image before running');
  console.log('  --help             Show this help message');
  console.log('');
  console.log('Environment:');
  console.log('  GITHUB_AUTH_TOKEN (or GITHUB_TOKEN) is required.');
}

function findProjectRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'data'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(startDir, '..');
}

function hasFlag(argv, name) {
  const flag = `--${name}`;
  const alt = `-${name}`;
  return argv.some((arg) => {
    const lower = arg.toLowerCase();
    return lower === flag || lower === alt;
  });
}

function getArgValue(argv, name) {
  const flag = `--${name}`;
  const alt = `-${name}`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const lower = arg.toLowerCase();
    if (lower.startsWith(`${flag}=`) || lower.startsWith(`${alt}=`)) {
      return arg.split('=')[1];
    }
    if (lower === flag || lower === alt) {
      return argv[i + 1];
    }
  }
  return null;
}

function parseNumberArg(argv, name) {
  const value = getArgValue(argv, name);
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // ignore log file errors
  }
}

function checkDocker() {
  const res = spawnSync('docker', ['version'], { encoding: 'utf8' });
  return res.status === 0;
}

function normalizeRepo(repo) {
  if (!repo || typeof repo !== 'string') return null;
  let value = repo.trim();
  const lower = value.toLowerCase();
  if ((lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('git@')) &&
    !lower.includes('github.com')) {
    return null;
  }
  value = value.replace(/^https?:\/\/github\.com\//i, '');
  value = value.replace(/^git@github\.com:/i, '');
  value = value.replace(/^github\.com\//i, '');
  value = value.replace(/\.git$/i, '');
  value = value.split('#')[0].split('?')[0];
  value = value.replace(/\/+$/, '');
  const parts = value.split('/');
  if (parts.length < 2) return null;
  return `${parts[0]}/${parts[1]}`;
}

function collectRepos(platformsFilter) {
  const repos = [];
  const seen = new Set();
  const platformsToUse = platformsFilter && platformsFilter.length
    ? platformsFilter
    : ALL_PLATFORMS;

  for (const platform of platformsToUse) {
    const top100Path = path.join(PLATFORM_ROOT, platform, 'top100.json');
    if (!fs.existsSync(top100Path)) {
      log(`Skipping ${platform} - top100.json not found`, 'WARN');
      continue;
    }
    const data = readJson(top100Path);
    const list = data?.top100 || [];
    let platformCount = 0;
    for (const plugin of list) {
      const repo = normalizeRepo(plugin?.repo);
      if (!repo) continue;
      if (seen.has(repo)) continue;
      seen.add(repo);
      repos.push({ repo, platform, name: plugin?.name || '' });
      platformCount += 1;
    }
    log(`Found ${platformCount} unique repos in ${platform}`, 'INFO');
  }

  log(`Total unique repositories: ${repos.length}`, 'INFO');
  return repos;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getOutputFilename(outputDir, repo) {
  const safe = repo.replace('/', '__');
  return path.join(outputDir, `${safe}.json`);
}

function isValidScorecardFile(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data && (data.score !== undefined || data.repo);
  } catch {
    return false;
  }
}

function runScorecard(repo, outputFile) {
  const tempFile = `${outputFile}.tmp`;
  const args = [
    'run',
    '--rm',
    '-e',
    `GITHUB_AUTH_TOKEN=${GITHUB_TOKEN}`,
    IMAGE,
    `--repo=github.com/${repo}`,
    '--format=json',
  ];

  const res = spawnSync('docker', args, { encoding: 'utf8' });
  if (res.error) {
    log(`Docker error for ${repo}: ${res.error.message}`, 'ERROR');
    return false;
  }
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim();
    log(`Scorecard failed for ${repo}: ${err || `exit code ${res.status}`}`, 'ERROR');
    return false;
  }

  const output = (res.stdout || '').trim();
  if (!output) {
    log(`Empty output for ${repo}`, 'ERROR');
    return false;
  }

  try {
    const json = JSON.parse(output);
    fs.writeFileSync(tempFile, JSON.stringify(json, null, 2));
    fs.renameSync(tempFile, outputFile);
    log(`Saved ${path.basename(outputFile)} (Score: ${json.score ?? 'N/A'})`, 'INFO');
    return true;
  } catch (err) {
    log(`Invalid JSON for ${repo}: ${err.message}`, 'ERROR');
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {
      // ignore
    }
    return false;
  }
}

function loadProcessed(filePath) {
  const set = new Set();
  if (!fs.existsSync(filePath)) return set;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const value = line.trim();
    if (value) set.add(value);
  }
  return set;
}

function addProcessed(filePath, repo) {
  try {
    fs.appendFileSync(filePath, `${repo}\n`);
  } catch {
    // ignore
  }
}

function sleep(ms) {
  if (typeof Atomics === 'object' && typeof Atomics.wait === 'function') {
    const buffer = new SharedArrayBuffer(4);
    const view = new Int32Array(buffer);
    Atomics.wait(view, 0, 0, ms);
    return;
  }
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
