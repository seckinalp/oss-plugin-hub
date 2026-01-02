#!/usr/bin/env node

/**
 * Fetch missing SBOM files
 * Retries only the plugins that don't have SBOM files yet
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATA_DIR = path.join(__dirname, '../data');
const SBOM_DIR = path.join(DATA_DIR, 'sbom');
const MISSING_LIST = path.join(DATA_DIR, 'missing-sboms.json');

const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const REQUEST_DELAY_MS = parseInt(process.env.SBOM_DELAY_MS || '200', 10);
const RATE_LIMIT_RETRY_MS = parseInt(process.env.SBOM_RETRY_MS || '5000', 10);
const MAX_RETRIES = 3;

// CLI options
const FORCE = process.argv.includes('--force') || process.argv.includes('-f');
const LIMIT = process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1];
const MAX_ITEMS = LIMIT ? parseInt(LIMIT, 10) : Infinity;
const PLATFORM_FILTER = process.argv.find(arg => arg.startsWith('--platform='))?.split('=')[1];

function log(...args) {
  console.log(...args);
}

function ensureDirs() {
  fs.mkdirSync(SBOM_DIR, { recursive: true });
}

function request(url) {
  const headers = {
    'User-Agent': 'oss-plugin-hub-sbom-fetcher',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
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
          resolve({ 
            status: res.statusCode || 0, 
            body: data,
            headers: res.headers 
          });
        });
      })
      .on('error', reject);
  });
}

async function fetchSbom(owner, repo, retryCount = 0) {
  const url = `https://api.github.com/repos/${owner}/${repo}/dependency-graph/sbom`;
  
  try {
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

    if (res.status === 403) {
      // Check if it's rate limit
      const remaining = res.headers['x-ratelimit-remaining'];
      const resetTime = res.headers['x-ratelimit-reset'];
      
      if (remaining === '0') {
        const waitTime = resetTime ? (parseInt(resetTime) * 1000 - Date.now()) : RATE_LIMIT_RETRY_MS;
        return { 
          status: 'rate_limited', 
          message: `Rate limited (403), resets at ${new Date(parseInt(resetTime) * 1000).toLocaleTimeString()}`,
          waitTime: Math.max(waitTime, 0)
        };
      }
      
      return { status: 'forbidden', message: 'Access forbidden (403)' };
    }

    if (res.status === 429) {
      const retryAfter = res.headers['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : RATE_LIMIT_RETRY_MS;
      
      if (retryCount < MAX_RETRIES) {
        log(`  Rate limited, waiting ${Math.round(waitTime / 1000)}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await sleep(waitTime);
        return fetchSbom(owner, repo, retryCount + 1);
      }
      
      return { 
        status: 'rate_limited', 
        message: `Rate limited (429), max retries reached`,
        waitTime
      };
    }

    return { status: 'error', message: `HTTP ${res.status}` };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  log('=== Fetching Missing SBOMs ===\n');
  
  if (!GH_TOKEN) {
    log('⚠️  Warning: No GitHub token found. You may hit rate limits quickly.');
    log('   Set GH_TOKEN or GITHUB_TOKEN in your .env file.\n');
  }

  ensureDirs();

  // Check if missing list exists, if not, generate it
  if (!fs.existsSync(MISSING_LIST)) {
    log('Missing SBOMs list not found. Generating...\n');
    const { execSync } = await import('child_process');
    execSync('node -e "' + 
      'const fs = require(\'fs\');' +
      'const platforms = [\'chrome\', \'firefox\', \'homeassistant\', \'jetbrains\', \'minecraft\', \'obsidian\', \'sublime\', \'vscode\', \'wordpress\'];' +
      'const sbomFiles = new Set(fs.readdirSync(\'data/sbom\').filter(f => f.endsWith(\'.sbom.json\')).map(f => f.replace(\'.sbom.json\', \'\')));' +
      'let missing = [];' +
      'platforms.forEach(p => {' +
      '  const data = JSON.parse(fs.readFileSync(`data/${p}/top100.json`, \'utf8\'));' +
      '  data.top100.forEach(item => {' +
      '    if (item.repo && !sbomFiles.has(item.repo.replace(\'/\', \'__\'))) {' +
      '      missing.push({ platform: p, repo: item.repo, name: item.name, filename: item.repo.replace(\'/\', \'__\') });' +
      '    }' +
      '  });' +
      '});' +
      'fs.writeFileSync(\'data/missing-sboms.json\', JSON.stringify(missing, null, 2));' +
      '"', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  }

  let missing = JSON.parse(fs.readFileSync(MISSING_LIST, 'utf8'));
  
  // Apply platform filter
  if (PLATFORM_FILTER) {
    const platforms = PLATFORM_FILTER.split(',').map(p => p.trim());
    missing = missing.filter(m => platforms.includes(m.platform));
    log(`Filtering to platforms: ${platforms.join(', ')}\n`);
  }

  // Apply limit
  if (MAX_ITEMS < missing.length) {
    log(`Limiting to first ${MAX_ITEMS} items\n`);
    missing = missing.slice(0, MAX_ITEMS);
  }

  log(`Found ${missing.length} missing SBOMs to fetch\n`);
  
  if (missing.length === 0) {
    log('✅ All SBOMs are already fetched!\n');
    return;
  }

  const stats = {
    total: missing.length,
    success: 0,
    notFound: 0,
    rateLimited: 0,
    forbidden: 0,
    errors: 0,
    skipped: 0,
  };

  for (let i = 0; i < missing.length; i++) {
    const item = missing[i];
    const [owner, repo] = item.repo.split('/');
    const filename = item.filename + '.sbom.json';
    const filepath = path.join(SBOM_DIR, filename);

    log(`[${i + 1}/${missing.length}] ${item.platform}: ${item.repo}`);

    // Skip if already exists (unless force)
    if (!FORCE && fs.existsSync(filepath)) {
      log('  ⏭️  Already exists, skipping\n');
      stats.skipped++;
      continue;
    }

    const result = await fetchSbom(owner, repo);

    if (result.status === 'ok') {
      fs.writeFileSync(filepath, JSON.stringify(result.sbom, null, 2));
      log('  ✅ Success\n');
      stats.success++;
    } else if (result.status === 'not_found') {
      log(`  ❌ Not found\n`);
      stats.notFound++;
    } else if (result.status === 'rate_limited') {
      log(`  ⏸️  ${result.message}\n`);
      stats.rateLimited++;
      
      if (result.waitTime && result.waitTime > 0) {
        log(`\n⚠️  Rate limit hit. Waiting ${Math.round(result.waitTime / 1000)}s...\n`);
        await sleep(result.waitTime);
        // Retry this item
        i--;
        continue;
      } else {
        log('\n⚠️  Rate limit hit and no retry-after provided. Stopping.\n');
        break;
      }
    } else if (result.status === 'forbidden') {
      log(`  🚫 ${result.message}\n`);
      stats.forbidden++;
    } else {
      log(`  ❌ Error: ${result.message}\n`);
      stats.errors++;
    }

    // Rate limiting delay between requests
    if (i < missing.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  log('======================================');
  log('Fetch Complete!');
  log('======================================\n');
  log('Summary:');
  log(`  Total attempted: ${stats.total}`);
  log(`  ✅ Success: ${stats.success}`);
  log(`  ⏭️  Skipped (existing): ${stats.skipped}`);
  log(`  ❌ Not found: ${stats.notFound}`);
  log(`  ⏸️  Rate limited: ${stats.rateLimited}`);
  log(`  🚫 Forbidden: ${stats.forbidden}`);
  log(`  ❌ Errors: ${stats.errors}\n`);
  
  if (stats.success > 0) {
    log('✅ SBOMs saved to:', SBOM_DIR);
    log('\nNext steps:');
    log('  1. Scan with OSV: npm run scan-osv -- --docker');
    log('  2. Analyze vulnerabilities: npm run analyze-vulnerabilities');
    log('  3. Generate summary: npm run vulnerability-summary\n');
  }
  
  if (stats.rateLimited > 0) {
    log('💡 Tip: Wait for rate limit to reset and re-run this script');
    log('   Or use multiple GitHub tokens with different accounts\n');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});














