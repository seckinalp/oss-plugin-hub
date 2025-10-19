/**
 * Incremental GitHub Stats Update Script
 * 
 * This script updates GitHub statistics for a limited number of plugins per run,
 * designed to work around GitHub API rate limits by:
 * - Only fetching data for plugins that haven't been updated recently
 * - Prioritizing new plugins and oldest-updated plugins
 * - Limiting the number of API calls per run
 * 
 * Usage:
 *   node scripts/incremental-github-update.js [--limit=50] [--max-age-days=7]
 * 
 * Environment Variables:
 *   GH_TOKEN - GitHub Personal Access Token (optional but recommended)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '../data');
const PLUGINS_FILE = path.join(DATA_DIR, 'plugins.json');

const GH_TOKEN = process.env.GH_TOKEN;
const GITHUB_API = 'https://api.github.com';

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const maxAgeDaysArg = args.find(arg => arg.startsWith('--max-age-days='));

const PLUGINS_PER_RUN = limitArg ? parseInt(limitArg.split('=')[1]) : 150; // Fetch up to 150 plugins per run
const MAX_AGE_DAYS = maxAgeDaysArg ? parseInt(maxAgeDaysArg.split('=')[1]) : 7; // Re-fetch if older than 7 days
const DELAY_MS = 50; // Delay between requests (50ms)
const MAX_API_CALLS_PER_PLUGIN = 10; // Approximate API calls per plugin (for rate limit estimation)

/**
 * Get headers for GitHub API requests
 */
function getHeaders() {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (GH_TOKEN) {
    headers['Authorization'] = `token ${GH_TOKEN}`;
  }

  return headers;
}

/**
 * Check GitHub API rate limit
 */
async function checkRateLimit() {
  try {
    const response = await fetch(`${GITHUB_API}/rate_limit`, { 
      headers: getHeaders() 
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const core = data.resources.core;

    return {
      limit: core.limit,
      remaining: core.remaining,
      reset: new Date(core.reset * 1000),
      used: core.used,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error.message);
    return null;
  }
}

/**
 * Fetch releases
 */
async function fetchReleases(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=10`, {
      headers: getHeaders(),
    });

    if (!response.ok) return { releases: [], count: 0, latest: null };

    const data = await response.json();
    const releases = data.map(r => ({
      tag_name: r.tag_name,
      name: r.name || r.tag_name,
      published_at: r.published_at,
      html_url: r.html_url,
      body: r.body
    }));

    return {
      releases,
      count: releases.length,
      latest: releases[0] || null
    };
  } catch (error) {
    return { releases: [], count: 0, latest: null };
  }
}

/**
 * Fetch contributors
 */
async function fetchContributors(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=10`, {
      headers: getHeaders(),
    });

    if (!response.ok) return { total: 0, top: [] };

    const data = await response.json();
    const contributors = data.map(c => ({
      login: c.login,
      contributions: c.contributions,
      avatar_url: c.avatar_url,
      html_url: c.html_url
    }));

    return {
      total: contributors.length,
      top: contributors.slice(0, 5)
    };
  } catch (error) {
    return { total: 0, top: [] };
  }
}

/**
 * Fetch commit activity
 */
async function fetchCommitActivity(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/stats/commit_activity`, {
      headers: getHeaders(),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const totalCommits = data.reduce((sum, week) => sum + week.total, 0);
    const avgCommitsPerWeek = Math.round(totalCommits / data.length);
    const recentActivity = data.slice(-4).map(week => week.total);

    return {
      totalCommits,
      commitFrequency: avgCommitsPerWeek,
      recentActivity
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch language distribution
 */
async function fetchLanguageDistribution(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/languages`, {
      headers: getHeaders(),
    });

    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Check if file exists
 */
async function fileExists(owner, repo, path) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
      headers: getHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch governance files status
 */
async function fetchGovernance(owner, repo) {
  const checks = await Promise.all([
    fileExists(owner, repo, 'CONTRIBUTING.md').catch(() => fileExists(owner, repo, '.github/CONTRIBUTING.md')),
    fileExists(owner, repo, 'CODE_OF_CONDUCT.md').catch(() => fileExists(owner, repo, '.github/CODE_OF_CONDUCT.md')),
    fileExists(owner, repo, 'SECURITY.md').catch(() => fileExists(owner, repo, '.github/SECURITY.md')),
    fileExists(owner, repo, 'LICENSE').catch(() => fileExists(owner, repo, 'LICENSE.md'))
  ]);

  return {
    hasContributingGuide: checks[0],
    hasCodeOfConduct: checks[1],
    hasSecurityPolicy: checks[2],
    hasLicense: checks[3]
  };
}

/**
 * Fetch dependencies from package.json
 */
async function fetchDependencies(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/package.json`, {
      headers: { ...getHeaders(), 'Accept': 'application/vnd.github.v3.raw' },
    });

    if (!response.ok) return { deps: null, scripts: [] };

    const text = await response.text();
    const packageJson = JSON.parse(text);

    const deps = {
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
      peerDependencies: packageJson.peerDependencies
    };

    const scripts = packageJson.scripts ? Object.keys(packageJson.scripts).filter(
      s => s.includes('build') || s.includes('compile')
    ) : [];

    return { deps, scripts };
  } catch (error) {
    return { deps: null, scripts: [] };
  }
}

/**
 * Fetch workflows
 */
async function fetchWorkflows(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/.github/workflows`, {
      headers: getHeaders(),
    });

    if (!response.ok) return { hasWorkflows: false, count: 0 };

    const data = await response.json();
    const workflowFiles = Array.isArray(data) ? data.filter(f => 
      f.name.endsWith('.yml') || f.name.endsWith('.yaml')
    ) : [];

    return {
      hasWorkflows: workflowFiles.length > 0,
      count: workflowFiles.length
    };
  } catch (error) {
    return { hasWorkflows: false, count: 0 };
  }
}

/**
 * Fetch funding information
 */
async function fetchFunding(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/.github/FUNDING.yml`, {
      headers: { ...getHeaders(), 'Accept': 'application/vnd.github.v3.raw' },
    });

    if (!response.ok) return [];

    const text = await response.text();
    const fundingLinks = [];

    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, platform, value] = match;
        const username = value.trim().replace(/['"]/g, '');
        
        let url = '';
        switch (platform.toLowerCase()) {
          case 'github':
            url = `https://github.com/sponsors/${username}`;
            break;
          case 'patreon':
            url = `https://patreon.com/${username}`;
            break;
          case 'open_collective':
            url = `https://opencollective.com/${username}`;
            break;
          case 'ko_fi':
            url = `https://ko-fi.com/${username}`;
            break;
          case 'tidelift':
            url = `https://tidelift.com/funding/github/${username}`;
            break;
          case 'custom':
            url = username;
            break;
          default:
            url = username;
        }

        fundingLinks.push({ platform: platform.toLowerCase(), url });
      }
    }

    return fundingLinks;
  } catch (error) {
    return [];
  }
}

/**
 * Fetch closed issues count
 */
async function fetchClosedIssuesCount(owner, repo) {
  try {
    const response = await fetch(
      `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed&per_page=1`,
      { headers: getHeaders() }
    );

    if (!response.ok) return 0;

    const data = await response.json();
    return data.total_count || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Fetch PR counts
 */
async function fetchPRCounts(owner, repo) {
  try {
    const [openResponse, closedResponse] = await Promise.all([
      fetch(
        `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:open&per_page=1`,
        { headers: getHeaders() }
      ),
      fetch(
        `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:closed&per_page=1`,
        { headers: getHeaders() }
      )
    ]);

    const openData = openResponse.ok ? await openResponse.json() : { total_count: 0 };
    const closedData = closedResponse.ok ? await closedResponse.json() : { total_count: 0 };

    return {
      open: openData.total_count || 0,
      closed: closedData.total_count || 0
    };
  } catch (error) {
    return { open: 0, closed: 0 };
  }
}

/**
 * Fetch comprehensive repository statistics from GitHub API
 */
async function fetchRepoStats(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: getHeaders(),
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

    // Basic stats from main endpoint
    const basicStats = {
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

    // Fetch comprehensive data in parallel
    const [
      releases,
      contributors,
      commitActivity,
      languageDistribution,
      governance,
      dependencies,
      workflows,
      funding,
      closedIssues,
      prCounts
    ] = await Promise.all([
      fetchReleases(owner, repo),
      fetchContributors(owner, repo),
      fetchCommitActivity(owner, repo),
      fetchLanguageDistribution(owner, repo),
      fetchGovernance(owner, repo),
      fetchDependencies(owner, repo),
      fetchWorkflows(owner, repo),
      fetchFunding(owner, repo),
      fetchClosedIssuesCount(owner, repo),
      fetchPRCounts(owner, repo)
    ]);

    return {
      ...basicStats,
      releaseCount: releases.count,
      currentVersion: releases.latest?.tag_name,
      latestReleaseDate: releases.latest?.published_at,
      latestRelease: releases.latest,
      totalContributors: contributors.total,
      topContributors: contributors.top,
      commitActivity,
      languageDistribution,
      governance,
      dependencies: dependencies.deps,
      buildScripts: dependencies.scripts,
      hasWorkflows: workflows.hasWorkflows,
      workflowCount: workflows.count,
      fundingLinks: funding,
      closedIssues,
      openPullRequests: prCounts.open,
      closedPullRequests: prCounts.closed
    };
  } catch (error) {
    console.error(`   Exception fetching ${owner}/${repo}:`, error.message);
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
 * Determine which plugins need updating
 */
function getPluginsToUpdate(plugins, maxAgeDays, limit) {
  const now = new Date();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  // Categorize plugins
  const neverFetched = [];
  const outdated = [];
  const upToDate = [];

  for (const plugin of plugins) {
    if (!plugin.repo) continue;

    if (!plugin.githubDataFetchedAt) {
      // Never fetched - highest priority
      neverFetched.push(plugin);
    } else {
      const fetchedAt = new Date(plugin.githubDataFetchedAt);
      const age = now - fetchedAt;

      if (age > maxAgeMs) {
        // Outdated - needs refresh
        outdated.push({ plugin, age });
      } else {
        // Up to date
        upToDate.push(plugin);
      }
    }
  }

  // Sort outdated by age (oldest first)
  outdated.sort((a, b) => b.age - a.age);

  // Combine: never fetched first, then outdated (oldest first)
  const toUpdate = [
    ...neverFetched,
    ...outdated.map(item => item.plugin)
  ];

  // Limit the number of plugins to update
  const limited = toUpdate.slice(0, limit);

  return {
    toUpdate: limited,
    neverFetchedCount: neverFetched.length,
    outdatedCount: outdated.length,
    upToDateCount: upToDate.length,
    totalCount: plugins.length
  };
}

/**
 * Main script
 */
async function main() {
  console.log('🚀 Starting incremental GitHub stats update...\n');

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
    console.log(`   Resets at: ${rateLimit.reset.toLocaleString()}`);
    
    // Estimate if we have enough quota
    const estimatedCalls = PLUGINS_PER_RUN * MAX_API_CALLS_PER_PLUGIN;
    if (rateLimit.remaining < estimatedCalls) {
      console.log(`   ⚠️  Warning: May not have enough quota for ${PLUGINS_PER_RUN} plugins (need ~${estimatedCalls} calls)`);
      console.log(`   Consider reducing --limit or waiting until rate limit resets\n`);
    } else {
      console.log(`   ✓ Sufficient quota for ${PLUGINS_PER_RUN} plugins\n`);
    }
  }

  // Load plugin data
  if (!fs.existsSync(PLUGINS_FILE)) {
    console.error('❌ Error: plugins.json not found. Run fetch-plugins.js first.');
    process.exit(1);
  }

  console.log('📥 Loading plugin data...');
  const data = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
  console.log(`   Loaded ${data.plugins.length} plugins\n`);

  // Determine which plugins to update
  console.log(`📋 Analyzing plugins (max age: ${MAX_AGE_DAYS} days, limit: ${PLUGINS_PER_RUN})...`);
  const updateInfo = getPluginsToUpdate(data.plugins, MAX_AGE_DAYS, PLUGINS_PER_RUN);

  console.log(`   Never fetched: ${updateInfo.neverFetchedCount}`);
  console.log(`   Outdated: ${updateInfo.outdatedCount}`);
  console.log(`   Up to date: ${updateInfo.upToDateCount}`);
  console.log(`   Plugins to update this run: ${updateInfo.toUpdate.length}\n`);

  if (updateInfo.toUpdate.length === 0) {
    console.log('✅ All plugins are up to date! No updates needed.');
    process.exit(0);
  }

  console.log(`🔄 Updating GitHub stats for ${updateInfo.toUpdate.length} plugins...\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const plugin of updateInfo.toUpdate) {
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
      plugin.githubDataFetchedAt = new Date().toISOString();
      updated++;
      console.log(`   ✓ ${plugin.name} (${stats.stars} ⭐)`);
    } else {
      // Even if it failed, mark as attempted to avoid retrying immediately
      plugin.githubDataFetchedAt = new Date().toISOString();
      failed++;
    }

    // Small delay to avoid rate limits
    await delay(DELAY_MS);
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
  console.log(`   📈 Total processed: ${updateInfo.toUpdate.length}`);
  console.log(`   🔄 Remaining to update: ${updateInfo.neverFetchedCount + updateInfo.outdatedCount - updateInfo.toUpdate.length}`);

  // Final rate limit check
  const finalRateLimit = await checkRateLimit();
  if (finalRateLimit) {
    console.log(`\n📊 Final Rate Limit:`);
    console.log(`   Remaining: ${finalRateLimit.remaining}/${finalRateLimit.limit}`);
    console.log(`   Used this run: ${rateLimit ? rateLimit.remaining - finalRateLimit.remaining : 'N/A'}`);
  }

  console.log('\n✅ Incremental update complete!');
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});

