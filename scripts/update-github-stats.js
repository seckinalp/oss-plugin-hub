/**
 * Update plugin data with GitHub statistics
 * This script fetches GitHub repository stats for all plugins and updates the data file.
 * 
 * Usage:
 *   node scripts/update-github-stats.js
 * 
 * Environment Variables:
 *   GH_TOKEN - GitHub Personal Access Token (optional but recommended to avoid rate limits)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '../data');
const PLUGINS_FILE = path.join(DATA_DIR, 'plugins.json');
const BACKUP_FILE = path.join(DATA_DIR, 'plugins-before-github-stats.json');

const GH_TOKEN = process.env.GH_TOKEN;
const GITHUB_API = 'https://api.github.com';
const BATCH_SIZE = 100; // Process in batches
const DELAY_MS = 1000; // Delay between batches (1 second)

/**
 * Fetch repository statistics from GitHub API
 */
async function fetchRepoStats(owner, repo) {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (GH_TOKEN) {
      headers['Authorization'] = `token ${GH_TOKEN}`;
    }

    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`   Repository not found: ${owner}/${repo}`);
      } else if (response.status === 429) {
        console.log(`   Rate limit exceeded for ${owner}/${repo}`);
      } else {
        console.log(`   Error ${response.status} for ${owner}/${repo}`);
      }
      return null;
    }

    const data = await response.json();

    return {
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      openIssues: data.open_issues_count || 0,
      watchers: data.watchers_count || 0,
      lastUpdated: data.pushed_at || data.updated_at,
      createdAt: data.created_at,
      license: data.license?.name || null,
      homepage: data.homepage || null,
      topics: data.topics || [],
      language: data.language || null,
      size: data.size || 0,
      defaultBranch: data.default_branch || 'main',
      archived: data.archived || false,
      disabled: data.disabled || false,
      hasWiki: data.has_wiki || false,
      hasPages: data.has_pages || false,
      description: data.description || null,
    };
  } catch (error) {
    console.error(`   Exception fetching ${owner}/${repo}:`, error.message);
    return null;
  }
}

/**
 * Check GitHub API rate limit
 */
async function checkRateLimit() {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (GH_TOKEN) {
      headers['Authorization'] = `token ${GH_TOKEN}`;
    }

    const response = await fetch(`${GITHUB_API}/rate_limit`, { headers });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const core = data.resources.core;

    return {
      limit: core.limit,
      remaining: core.remaining,
      reset: new Date(core.reset * 1000),
    };
  } catch (error) {
    console.error('Error checking rate limit:', error.message);
    return null;
  }
}

/**
 * Parse repository string into owner and repo
 */
function parseRepo(repoString) {
  const parts = repoString.split('/');
  if (parts.length !== 2) {
    return null;
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Delay execution
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main script
 */
async function main() {
  console.log('🚀 Starting GitHub stats update...\n');

  // Check if GH_TOKEN is set
  if (!GH_TOKEN) {
    console.log('⚠️  Warning: GH_TOKEN not set. Rate limits will be lower.');
    console.log('   Authenticated: 5,000 requests/hour');
    console.log('   Unauthenticated: 60 requests/hour\n');
  }

  // Check rate limit
  const rateLimit = await checkRateLimit();
  if (rateLimit) {
    console.log(`📊 GitHub API Rate Limit:`);
    console.log(`   Remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
    console.log(`   Resets at: ${rateLimit.reset.toLocaleString()}\n`);
  }

  // Load plugin data
  if (!fs.existsSync(PLUGINS_FILE)) {
    console.error('❌ Error: plugins.json not found. Run fetch-plugins.js first.');
    process.exit(1);
  }

  console.log('📥 Loading plugin data...');
  const data = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
  console.log(`   Loaded ${data.plugins.length} plugins\n`);

  // Create backup
  console.log('💾 Creating backup...');
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));
  console.log(`   Backup saved to ${path.relative(process.cwd(), BACKUP_FILE)}\n`);

  // Filter plugins that need GitHub stats
  const pluginsNeedingStats = data.plugins.filter(plugin => !plugin.github);
  const totalPlugins = pluginsNeedingStats.length;

  if (totalPlugins === 0) {
    console.log('✅ All plugins already have GitHub stats!');
    process.exit(0);
  }

  console.log(`🔄 Updating GitHub stats for ${totalPlugins} plugins...\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // Process in batches
  for (let i = 0; i < pluginsNeedingStats.length; i += BATCH_SIZE) {
    const batch = pluginsNeedingStats.slice(i, Math.min(i + BATCH_SIZE, pluginsNeedingStats.length));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pluginsNeedingStats.length / BATCH_SIZE);

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} plugins)...`);

    for (const plugin of batch) {
      if (!plugin.repo) {
        skipped++;
        continue;
      }

      const parsed = parseRepo(plugin.repo);
      if (!parsed) {
        console.log(`   ⚠️  Invalid repo format: ${plugin.repo}`);
        skipped++;
        continue;
      }

      const stats = await fetchRepoStats(parsed.owner, parsed.repo);
      if (stats) {
        plugin.github = stats;
        updated++;
        console.log(`   ✓ ${plugin.name} (${stats.stars} ⭐)`);
      } else {
        failed++;
      }

      // Small delay to avoid rate limits
      await delay(100);
    }

    // Delay between batches
    if (i + BATCH_SIZE < pluginsNeedingStats.length) {
      console.log(`   ⏸️  Waiting ${DELAY_MS}ms before next batch...\n`);
      await delay(DELAY_MS);
    }
  }

  // Save updated data
  console.log('\n💾 Saving updated plugin data...');
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify(data, null, 2));
  console.log(`   Saved to ${path.relative(process.cwd(), PLUGINS_FILE)}`);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📈 Total: ${totalPlugins}`);

  // Final rate limit check
  const finalRateLimit = await checkRateLimit();
  if (finalRateLimit) {
    console.log(`\n📊 Final Rate Limit:`);
    console.log(`   Remaining: ${finalRateLimit.remaining}/${finalRateLimit.limit}`);
  }

  console.log('\n✅ GitHub stats update complete!');
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});

