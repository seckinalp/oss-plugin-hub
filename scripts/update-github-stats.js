import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configuration
const DATA_DIR = path.join(__dirname, '../data');
const PLATFORMS = ['obsidian', 'vscode', 'minecraft', 'firefox', 'wordpress', 'homeassistant', 'jetbrains', 'sublime', 'chrome']; // All 9 platforms
const GITHUB_API = 'https://api.github.com';
const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

// Rate limiting
const DELAY_MS = GH_TOKEN ? 100 : 1000; // Faster with token, slower without

// Command line arguments
const FORCE_REFETCH = process.argv.includes('--force') || process.argv.includes('-f');
const PLATFORM_ARG = process.argv.find(arg => arg.startsWith('--platform='))?.split('=')[1] || 
                    (process.argv.includes('--platform') ? process.argv[process.argv.indexOf('--platform') + 1] : null);
const TARGET_PLATFORMS = PLATFORM_ARG ? [PLATFORM_ARG] : PLATFORMS;

// API call tracking
let apiCallStats = {
  total: 0,
  successful: 0,
  failed: 0,
  rateLimitErrors: 0,
  notFoundErrors: 0,
  byEndpoint: {}
};

/**
 * Track API call statistics
 */
function trackApiCall(endpoint, success, statusCode) {
  apiCallStats.total++;
  
  if (success) {
    apiCallStats.successful++;
  } else {
    apiCallStats.failed++;
    if (statusCode === 403) {
      apiCallStats.rateLimitErrors++;
    } else if (statusCode === 404) {
      apiCallStats.notFoundErrors++;
    }
  }

  // Track by endpoint type
  const endpointType = endpoint.split('/').slice(0, 5).join('/'); // Simplified endpoint
  if (!apiCallStats.byEndpoint[endpointType]) {
    apiCallStats.byEndpoint[endpointType] = { total: 0, successful: 0, failed: 0 };
  }
  apiCallStats.byEndpoint[endpointType].total++;
  if (success) {
    apiCallStats.byEndpoint[endpointType].successful++;
  } else {
    apiCallStats.byEndpoint[endpointType].failed++;
  }
}

/**
 * Make a request to GitHub API
 */
function fetchGitHub(url, acceptHeader = 'application/vnd.github.v3+json') {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'OSS-Plugin-Hub',
      'Accept': acceptHeader
    };

    if (GH_TOKEN) {
      headers['Authorization'] = `token ${GH_TOKEN}`;
    }

    const isRaw = acceptHeader.includes('raw');

    https.get(url, { headers }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            trackApiCall(url, true, res.statusCode);
            // If requesting raw content, return as-is
            if (isRaw) {
              resolve(data);
            } else {
              const json = JSON.parse(data);
              resolve(json);
            }
          } catch (error) {
            trackApiCall(url, false, res.statusCode);
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else if (res.statusCode === 404) {
          trackApiCall(url, true, res.statusCode); // Not found is expected
          resolve(null);
        } else if (res.statusCode === 403) {
          trackApiCall(url, false, res.statusCode);
          reject(new Error(`Rate limit exceeded. Please add a GitHub token.`));
        } else if (res.statusCode === 202) {
          // GitHub stats endpoints return 202 when computing, treat as null
          trackApiCall(url, true, res.statusCode);
          resolve(null);
        } else {
          trackApiCall(url, false, res.statusCode);
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    }).on('error', (error) => {
      trackApiCall(url, false, 0);
      reject(error);
    });
  });
}

/**
 * Fetch releases
 */
async function fetchReleases(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=10`;
    const data = await fetchGitHub(url);
    if (!data || !Array.isArray(data)) return { releases: [], count: 0, latest: null };

    const releases = data.map(r => ({
      tag_name: r.tag_name,
      name: r.name || r.tag_name,
      published_at: r.published_at,
      html_url: r.html_url,
      body: r.body
    }));

    return { releases, count: releases.length, latest: releases[0] || null };
  } catch (error) {
    return { releases: [], count: 0, latest: null };
  }
}

/**
 * Fetch contributors
 */
async function fetchContributors(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=10`;
    const data = await fetchGitHub(url);
    if (!data || !Array.isArray(data)) return { total: 0, top: [] };

    const contributors = data.map(c => ({
      login: c.login,
      contributions: c.contributions,
      avatar_url: c.avatar_url,
      html_url: c.html_url
    }));

    return { total: contributors.length, top: contributors.slice(0, 5) };
  } catch (error) {
    return { total: 0, top: [] };
  }
}

/**
 * Fetch commit activity
 */
async function fetchCommitActivity(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/stats/commit_activity`;
    const data = await fetchGitHub(url);
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    const totalCommits = data.reduce((sum, week) => sum + week.total, 0);
    const avgCommitsPerWeek = Math.round(totalCommits / data.length);
    const recentActivity = data.slice(-4).map(week => week.total);

    return { totalCommits, commitFrequency: avgCommitsPerWeek, recentActivity };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch language distribution
 */
async function fetchLanguageDistribution(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/languages`;
    const data = await fetchGitHub(url);
    return data || null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if file exists in repository
 */
async function fileExists(owner, repo, filePath) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`;
    const data = await fetchGitHub(url);
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Fetch governance files
 */
async function fetchGovernance(owner, repo) {
  try {
    const [hasContributing, hasCodeOfConduct, hasSecurity, hasLicense] = await Promise.all([
      fileExists(owner, repo, 'CONTRIBUTING.md').catch(() => fileExists(owner, repo, '.github/CONTRIBUTING.md')),
      fileExists(owner, repo, 'CODE_OF_CONDUCT.md').catch(() => fileExists(owner, repo, '.github/CODE_OF_CONDUCT.md')),
      fileExists(owner, repo, 'SECURITY.md').catch(() => fileExists(owner, repo, '.github/SECURITY.md')),
      fileExists(owner, repo, 'LICENSE').catch(() => fileExists(owner, repo, 'LICENSE.md'))
    ]);

    return {
      hasContributingGuide: hasContributing,
      hasCodeOfConduct: hasCodeOfConduct,
      hasSecurityPolicy: hasSecurity,
      hasLicense: hasLicense
    };
  } catch (error) {
    return {
      hasContributingGuide: false,
      hasCodeOfConduct: false,
      hasSecurityPolicy: false,
      hasLicense: false
    };
  }
}

/**
 * Fetch dependencies from package.json
 */
async function fetchDependencies(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/package.json`;
    const data = await fetchGitHub(url);
    if (!data || !data.content) return { deps: null, scripts: [] };

    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const packageJson = JSON.parse(content);

    const deps = {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      peerDependencies: packageJson.peerDependencies || {}
    };

    const scripts = packageJson.scripts 
      ? Object.keys(packageJson.scripts).filter(s => s.includes('build') || s.includes('compile'))
      : [];

    return { deps, scripts };
  } catch (error) {
    return { deps: null, scripts: [] };
  }
}

/**
 * Fetch CI/CD workflows
 */
async function fetchWorkflows(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/.github/workflows`;
    const data = await fetchGitHub(url);
    if (!data || !Array.isArray(data)) return { hasWorkflows: false, count: 0 };

    const workflowFiles = data.filter(f => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));
    return { hasWorkflows: workflowFiles.length > 0, count: workflowFiles.length };
  } catch (error) {
    return { hasWorkflows: false, count: 0 };
  }
}

/**
 * Fetch funding information
 */
async function fetchFunding(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/.github/FUNDING.yml`;
    const data = await fetchGitHub(url);
    if (!data || !data.content) return [];

    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const fundingLinks = [];
    const lines = content.split('\n');

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
    const url = `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:issue+state:closed&per_page=1`;
    const data = await fetchGitHub(url);
    return data?.total_count || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Fetch PR counts
 */
async function fetchPRCounts(owner, repo) {
  try {
    const openUrl = `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:open&per_page=1`;
    const closedUrl = `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:pr+state:closed&per_page=1`;
    
    const openData = await fetchGitHub(openUrl);
    await delay(DELAY_MS);
    const closedData = await fetchGitHub(closedUrl);

    return {
      open: openData?.total_count || 0,
      closed: closedData?.total_count || 0
    };
  } catch (error) {
    return { open: 0, closed: 0 };
  }
}

/**
 * Fetch recent commits
 */
async function fetchRecentCommits(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=10`;
    const data = await fetchGitHub(url);
    if (!data || !Array.isArray(data)) return [];

    return data.map(commit => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Fetch tags
 */
async function fetchTags(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/tags?per_page=20`;
    const data = await fetchGitHub(url);
    if (!data || !Array.isArray(data)) return [];

    return data.map(tag => ({
      name: tag.name,
      sha: tag.commit.sha.substring(0, 7),
      zipball_url: tag.zipball_url,
      tarball_url: tag.tarball_url
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Fetch community profile
 */
async function fetchCommunityProfile(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/community/profile`;
    const data = await fetchGitHub(url);
    if (!data) return null;

    return {
      healthPercentage: data.health_percentage,
      description: data.description,
      documentation: data.documentation,
      files: data.files
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch code frequency
 */
async function fetchCodeFrequency(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/stats/code_frequency`;
    const data = await fetchGitHub(url);
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    const recent = data.slice(-12);
    const totalAdditions = recent.reduce((sum, week) => sum + week[1], 0);
    const totalDeletions = recent.reduce((sum, week) => sum + Math.abs(week[2]), 0);

    return {
      recentWeeks: recent.map(week => ({
        week: new Date(week[0] * 1000).toISOString(),
        additions: week[1],
        deletions: Math.abs(week[2])
      })),
      totalAdditions,
      totalDeletions
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fetch participation
 */
async function fetchParticipation(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/stats/participation`;
    const data = await fetchGitHub(url);
    if (!data || !data.all) return null;

    const recentAll = data.all.slice(-12);
    const recentOwner = data.owner.slice(-12);
    const totalAll = recentAll.reduce((a, b) => a + b, 0);
    const totalOwner = recentOwner.reduce((a, b) => a + b, 0);
    
    return {
      allCommits: recentAll,
      ownerCommits: recentOwner,
      communityCommits: recentAll.map((all, i) => all - recentOwner[i]),
      ownerPercentage: totalAll > 0 ? Math.round((totalOwner / totalAll) * 100) : 0
    };
  } catch (error) {
    return null;
  }
}

/**
 * Calculate health metrics
 */
function calculateHealthMetrics(openIssues, closedIssues, openPRs, closedPRs) {
  const totalIssues = openIssues + closedIssues;
  const issueCloseRate = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;

  const prTotal = openPRs + closedPRs;
  const prMergeRate = prTotal > 0 ? (closedPRs / prTotal) * 100 : 0;
  
  const maintenanceScore = Math.round(
    (issueCloseRate * 0.4) + 
    (Math.min(issueCloseRate, 100) * 0.3) + 
    (prMergeRate * 0.3)
  );

  return {
    issueCloseRate,
    maintenanceScore: Math.min(maintenanceScore, 100),
    responseRate: issueCloseRate
  };
}

/**
 * Fetch README content
 */
async function fetchReadme(owner, repo, branch) {
  try {
    // Try default README endpoint first
    let url = `${GITHUB_API}/repos/${owner}/${repo}/readme`;
    let data = await fetchGitHub(url, 'application/vnd.github.v3.raw');
    
    if (data) {
      return data;
    }

    // If failed and branch provided, try with branch
    if (branch) {
      url = `${GITHUB_API}/repos/${owner}/${repo}/readme?ref=${branch}`;
      data = await fetchGitHub(url, 'application/vnd.github.v3.raw');
      return data;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetch comprehensive repository stats from GitHub
 */
async function fetchRepoStats(owner, repo) {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}`;
    const data = await fetchGitHub(url);
    
    if (!data) {
      console.log(`   ⚠️  Repository not found: ${owner}/${repo}`);
      return null;
    }

    // Basic stats
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
      description: data.description || null
    };

    console.log(`   📊 Fetching comprehensive data...`);

    // Fetch all additional data
    await delay(DELAY_MS);
    const releases = await fetchReleases(owner, repo);
    await delay(DELAY_MS);
    const contributors = await fetchContributors(owner, repo);
    await delay(DELAY_MS);
    const commitActivity = await fetchCommitActivity(owner, repo);
    await delay(DELAY_MS);
    const languageDistribution = await fetchLanguageDistribution(owner, repo);
    await delay(DELAY_MS);
    const governance = await fetchGovernance(owner, repo);
    await delay(DELAY_MS);
    const dependencies = await fetchDependencies(owner, repo);
    await delay(DELAY_MS);
    const workflows = await fetchWorkflows(owner, repo);
    await delay(DELAY_MS);
    const funding = await fetchFunding(owner, repo);
    await delay(DELAY_MS);
    const closedIssues = await fetchClosedIssuesCount(owner, repo);
    await delay(DELAY_MS);
    const prCounts = await fetchPRCounts(owner, repo);
    await delay(DELAY_MS);
    const recentCommits = await fetchRecentCommits(owner, repo);
    await delay(DELAY_MS);
    const tags = await fetchTags(owner, repo);
    await delay(DELAY_MS);
    const communityProfile = await fetchCommunityProfile(owner, repo);
    await delay(DELAY_MS);
    const codeFrequency = await fetchCodeFrequency(owner, repo);
    await delay(DELAY_MS);
    const participation = await fetchParticipation(owner, repo);
    await delay(DELAY_MS);
    const readme = await fetchReadme(owner, repo, basicStats.defaultBranch);

    // Calculate health metrics
    const healthMetrics = calculateHealthMetrics(
      basicStats.openIssues,
      closedIssues,
      prCounts.open,
      prCounts.closed
    );

    return {
      ...basicStats,
      releaseCount: releases.count,
      currentVersion: releases.latest?.tag_name,
      latestReleaseDate: releases.latest?.published_at,
      latestRelease: releases.latest || undefined,
      totalContributors: contributors.total,
      topContributors: contributors.top,
      commitActivity: commitActivity || undefined,
      languageDistribution: languageDistribution || undefined,
      governance,
      dependencies: dependencies.deps || undefined,
      buildScripts: dependencies.scripts,
      hasWorkflows: workflows.hasWorkflows,
      workflowCount: workflows.count,
      fundingLinks: funding,
      closedIssues,
      openPullRequests: prCounts.open,
      closedPullRequests: prCounts.closed,
      healthMetrics,
      recentCommits: recentCommits.length > 0 ? recentCommits : undefined,
      tags: tags.length > 0 ? tags : undefined,
      tagsCount: tags.length,
      communityProfile: communityProfile || undefined,
      codeFrequency: codeFrequency || undefined,
      participation: participation || undefined,
      readme: readme || undefined
    };
  } catch (error) {
    console.error(`   ❌ Error fetching ${owner}/${repo}: ${error.message}`);
    return null;
  }
}

/**
 * Extract owner and repo from GitHub URL
 */
function parseRepoUrl(url) {
  if (!url) return null;
  
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\s]+)/i,
    /^([^\/]+)\/([^\/\s]+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '')
      };
    }
  }

  return null;
}

/**
 * Delay execution
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check GitHub API rate limit
 */
async function checkRateLimit() {
  try {
    const url = `${GITHUB_API}/rate_limit`;
    const data = await fetchGitHub(url);
    
    if (data && data.resources) {
      const core = data.resources.core;
      console.log(`\n📊 GitHub API Rate Limit:`);
      console.log(`   Used: ${core.used} / ${core.limit}`);
      console.log(`   Remaining: ${core.remaining}`);
      
      if (core.remaining < 10) {
        const resetDate = new Date(core.reset * 1000);
        console.log(`   ⚠️  Warning: Low rate limit. Resets at ${resetDate.toLocaleString()}`);
      }
      
      return core;
    }
  } catch (error) {
    console.log(`   ⚠️  Could not check rate limit: ${error.message}`);
  }
  return null;
}

/**
 * Display API call statistics
 */
function displayApiStats() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 API CALL STATISTICS');
  console.log('='.repeat(60));
  console.log(`Total API Calls:      ${apiCallStats.total}`);
  console.log(`Successful:           ${apiCallStats.successful} (${Math.round(apiCallStats.successful/apiCallStats.total*100)}%)`);
  console.log(`Failed:               ${apiCallStats.failed}`);
  if (apiCallStats.rateLimitErrors > 0) {
    console.log(`  Rate Limit Errors:  ${apiCallStats.rateLimitErrors}`);
  }
  if (apiCallStats.notFoundErrors > 0) {
    console.log(`  Not Found (404):    ${apiCallStats.notFoundErrors}`);
  }
  console.log('='.repeat(60));
}

/**
 * Load platform data
 */
function loadPlatformData(platform) {
  const platformDir = path.join(DATA_DIR, platform);
  const pluginsFile = path.join(platformDir, 'plugins.json');
  const metadataFile = path.join(platformDir, 'metadata.json');
  
  if (!fs.existsSync(pluginsFile)) {
    return null;
  }
  
  const pluginsData = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));
  const metadata = fs.existsSync(metadataFile) 
    ? JSON.parse(fs.readFileSync(metadataFile, 'utf8'))
    : {};
  
  return {
    plugins: pluginsData.plugins || [],
    metadata,
    pluginsFile,
    metadataFile
  };
}

/**
 * Save platform data
 */
function savePlatformData(platform, plugins, stats) {
  const platformDir = path.join(DATA_DIR, platform);
  const pluginsFile = path.join(platformDir, 'plugins.json');
  const metadataFile = path.join(platformDir, 'metadata.json');
  
  // Update metadata
  const pluginsWithStats = plugins.filter(p => p.githubStats);
  const metadata = {
    platform,
    totalCount: plugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: new Date().toISOString(),
    pluginsWithGitHubStats: pluginsWithStats.length,
    stats: {
      totalStars: stats.totalStars,
      totalForks: stats.totalForks,
      totalWatchers: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.watchers || 0), 0),
      openIssues: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.openIssues || 0), 0),
    }
  };
  
  // Save files
  fs.writeFileSync(pluginsFile, JSON.stringify({ plugins }, null, 2));
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();
  
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + '🚀 GITHUB STATS UPDATE SCRIPT' + ' '.repeat(18) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  // Show mode
  if (FORCE_REFETCH) {
    console.log('🔄 Mode: FORCE RE-FETCH (will update all plugins)');
  } else {
    console.log('🎯 Mode: INCREMENTAL (will only fetch new plugins without stats)');
    console.log('   Use --force or -f flag to re-fetch all plugins');
  }
  console.log('');

  // Load all platform data
  const platformData = {};
  for (const platform of TARGET_PLATFORMS) {
    const data = loadPlatformData(platform);
    if (data) {
      platformData[platform] = data;
      console.log(`✓ Loaded ${platform}: ${data.plugins.length} plugins`);
    } else {
      console.log(`⚠️  No data found for ${platform}`);
    }
  }
  
  if (Object.keys(platformData).length === 0) {
    console.error('❌ No platform data found. Run "npm run fetch-all-sources" first.');
    process.exit(1);
  }
  console.log('');

  // Check rate limit before starting
  console.log('📡 Checking GitHub API status...');
  const initialRateLimit = await checkRateLimit();

  if (!GH_TOKEN) {
    console.log('\n⚠️  WARNING: No GitHub token found!');
    console.log('   Current rate limit: 60 requests/hour (very limited)');
    console.log('   With token: 5000 requests/hour');
    console.log('   Set GH_TOKEN environment variable to increase limit\n');
    
    // Ask if user wants to continue
    console.log('   Each plugin requires ~21 API calls');
    console.log('   Without token, you can only process ~2-3 plugins per hour');
  } else {
    console.log(`✓ GitHub token found. Rate limit: ${initialRateLimit?.limit || 5000} requests/hour\n`);
  }

  // Collect only top 100 plugins from each platform
  const allPlugins = [];
  for (const platform in platformData) {
    const top100 = platformData[platform].plugins.filter(p => p.isTop100 === true);
    allPlugins.push(...top100);
    console.log(`   ${platform}: ${top100.length} top 100 plugins`);
  }
  console.log('');

  // Count plugins that need fetching
  const pluginsNeedingFetch = FORCE_REFETCH 
    ? allPlugins.length 
    : allPlugins.filter(p => !p.githubStats).length;
  const pluginsWithStats = allPlugins.filter(p => p.githubStats).length;

  console.log('═'.repeat(60));
  console.log(`📦 Total plugins across target platforms: ${allPlugins.length}`);
  console.log(`🎯 Target platforms: ${TARGET_PLATFORMS.join(', ')}`);
  if (!FORCE_REFETCH) {
    console.log(`   Already have stats: ${pluginsWithStats}`);
    console.log(`   Need to fetch: ${pluginsNeedingFetch}`);
  }
  console.log(`⏱️  Estimated API calls: ~${pluginsNeedingFetch * 21}`);
  console.log(`⏱️  Estimated time: ~${Math.round(pluginsNeedingFetch * DELAY_MS * 21 / 60000)} minutes`);
  console.log('═'.repeat(60));
  console.log('');

  let updated = 0;
  let skipped = 0;
  let skippedAlreadyHasStats = 0;
  let failed = 0;
  let pluginStats = {
    totalStars: 0,
    totalForks: 0,
    activePlugins: 0,
    archivedPlugins: 0
  };

  for (let i = 0; i < allPlugins.length; i++) {
    const plugin = allPlugins[i];
    const progress = `[${i + 1}/${allPlugins.length}]`;
    const percentage = Math.round((i / allPlugins.length) * 100);
    
    console.log(`\n${progress} (${percentage}%) ${plugin.name}`);
    console.log(`   Repo: ${plugin.repo}`);

    // Check if already has stats (unless force refetch)
    if (!FORCE_REFETCH && plugin.githubStats) {
      console.log(`   ⏭️  Skipping - already has stats (use --force to re-fetch)`);
      skippedAlreadyHasStats++;
      continue;
    }

    // Parse repository URL
    const repoInfo = parseRepoUrl(plugin.repo);
    
    if (!repoInfo) {
      console.log(`   ⚠️  Could not parse repository URL`);
      skipped++;
      continue;
    }

    // Fetch GitHub stats
    try {
      const stats = await fetchRepoStats(repoInfo.owner, repoInfo.repo);
      
      if (stats) {
        // Update plugin with GitHub stats
        plugin.githubStats = stats;
        
        // Track aggregate stats
        pluginStats.totalStars += stats.stars || 0;
        pluginStats.totalForks += stats.forks || 0;
        if (stats.archived) {
          pluginStats.archivedPlugins++;
        } else {
          pluginStats.activePlugins++;
        }
        
        console.log(`   ✅ Success!`);
        console.log(`      ⭐ ${stats.stars} stars | 🔀 ${stats.forks} forks | 📝 ${stats.openIssues} open issues`);
        console.log(`      📅 Last updated: ${new Date(stats.lastUpdated).toLocaleDateString()}`);
        if (stats.currentVersion) {
          console.log(`      🏷️  Version: ${stats.currentVersion}`);
        }
        updated++;
      } else {
        console.log(`   ❌ Failed to fetch stats`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
      
      // If rate limit error, stop processing immediately
      if (error.message.includes('Rate limit')) {
        console.log('\n⛔ RATE LIMIT EXCEEDED! Stopping to avoid wasting API calls.');
        console.log(`   Processed ${updated} plugins successfully before hitting limit.`);
        console.log(`   You can run the script again later or add a GitHub token for higher limits.`);
        break;
      }
    }

    // Rate limiting delay
    if (i < allPlugins.length - 1) {
      await delay(DELAY_MS);
    }

    // Show progress every 10 plugins
    if ((i + 1) % 10 === 0) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`Progress: ${i + 1}/${allPlugins.length} plugins processed`);
      console.log(`API Calls so far: ${apiCallStats.total}`);
      console.log(`${'─'.repeat(60)}`);
    }
  }

  // Save each platform's data separately
  console.log('\n💾 Saving updated data for each platform...');
  for (const platform in platformData) {
    const platformPlugins = platformData[platform].plugins;
    savePlatformData(platform, platformPlugins, pluginStats);
    console.log(`   ✓ Saved ${platform}/plugins.json and metadata.json`);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Final summary
  console.log('\n\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(18) + '📋 FINAL SUMMARY' + ' '.repeat(24) + '║');
  console.log('╠' + '═'.repeat(58) + '╣');
  console.log(`║  Plugins Updated:      ${updated.toString().padEnd(35)} ║`);
  if (skippedAlreadyHasStats > 0) {
    console.log(`║  Already Had Stats:    ${skippedAlreadyHasStats.toString().padEnd(35)} ║`);
  }
  console.log(`║  Skipped (No Repo):    ${skipped.toString().padEnd(35)} ║`);
  console.log(`║  Failed:               ${failed.toString().padEnd(35)} ║`);
  console.log(`║  ${'─'.repeat(56)} ║`);
  console.log(`║  Total Stars:          ${pluginStats.totalStars.toLocaleString().padEnd(35)} ║`);
  console.log(`║  Total Forks:          ${pluginStats.totalForks.toLocaleString().padEnd(35)} ║`);
  console.log(`║  Active Plugins:       ${pluginStats.activePlugins.toString().padEnd(35)} ║`);
  console.log(`║  Archived Plugins:     ${pluginStats.archivedPlugins.toString().padEnd(35)} ║`);
  console.log(`║  ${'─'.repeat(56)} ║`);
  console.log(`║  Time Taken:           ${duration}s${' '.repeat(35 - duration.length - 1)} ║`);
  console.log(`║  Platforms Updated:    ${Object.keys(platformData).join(', ').padEnd(35)} ║`);
  console.log('╚' + '═'.repeat(58) + '╝');

  // Display API statistics
  displayApiStats();

  // Final rate limit check
  console.log('\n📡 Final rate limit check...');
  await checkRateLimit();

  console.log('\n✅ All done! You can now commit and push the updated platform data\n');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  displayApiStats();
  process.exit(1);
});

