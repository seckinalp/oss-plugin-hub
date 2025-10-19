/**
 * Test script to fetch comprehensive GitHub data for a single plugin
 * Usage: node scripts/test-single-plugin.js obsidian-tasks-group obsidian-tasks
 */

const fs = require('fs');
const path = require('path');

const GH_TOKEN = process.env.GH_TOKEN;
const GITHUB_API = 'https://api.github.com';

function getHeaders() {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (GH_TOKEN) {
    headers['Authorization'] = `token ${GH_TOKEN}`;
  }

  return headers;
}

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
    console.error('Error fetching releases:', error.message);
    return { releases: [], count: 0, latest: null };
  }
}

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
    console.error('Error fetching contributors:', error.message);
    return { total: 0, top: [] };
  }
}

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
    console.error('Error fetching commit activity:', error.message);
    return null;
  }
}

async function fetchLanguageDistribution(owner, repo) {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/languages`, {
      headers: getHeaders(),
    });

    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error('Error fetching languages:', error.message);
    return null;
  }
}

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

async function fetchGovernance(owner, repo) {
  console.log('   Checking governance files...');
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
    console.error('Error fetching dependencies:', error.message);
    return { deps: null, scripts: [] };
  }
}

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
    console.error('Error fetching workflows:', error.message);
    return { hasWorkflows: false, count: 0 };
  }
}

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
    console.error('Error fetching funding:', error.message);
    return [];
  }
}

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
    console.error('Error fetching closed issues:', error.message);
    return 0;
  }
}

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
    console.error('Error fetching PR counts:', error.message);
    return { open: 0, closed: 0 };
  }
}

async function fetchComprehensiveStats(owner, repo) {
  console.log(`\n🔍 Fetching comprehensive GitHub stats for ${owner}/${repo}...\n`);

  try {
    // Fetch main repo data
    console.log('1. Fetching repository metadata...');
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch repository: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('   ✓ Repository metadata fetched');

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

    console.log(`   ⭐ Stars: ${basicStats.stars}`);
    console.log(`   🍴 Forks: ${basicStats.forks}`);

    // Fetch comprehensive data
    console.log('\n2. Fetching releases...');
    const releases = await fetchReleases(owner, repo);
    console.log(`   ✓ Found ${releases.count} releases`);

    console.log('\n3. Fetching contributors...');
    const contributors = await fetchContributors(owner, repo);
    console.log(`   ✓ Found ${contributors.total} contributors`);

    console.log('\n4. Fetching commit activity...');
    const commitActivity = await fetchCommitActivity(owner, repo);
    console.log(`   ✓ Commit activity: ${commitActivity ? 'available' : 'unavailable'}`);

    console.log('\n5. Fetching language distribution...');
    const languageDistribution = await fetchLanguageDistribution(owner, repo);
    console.log(`   ✓ Languages: ${languageDistribution ? Object.keys(languageDistribution).length : 0}`);

    console.log('\n6. Checking governance files...');
    const governance = await fetchGovernance(owner, repo);
    console.log(`   ✓ Governance checked`);

    console.log('\n7. Fetching dependencies...');
    const dependencies = await fetchDependencies(owner, repo);
    console.log(`   ✓ Dependencies: ${dependencies.deps ? 'found' : 'not found'}`);

    console.log('\n8. Checking CI/CD workflows...');
    const workflows = await fetchWorkflows(owner, repo);
    console.log(`   ✓ Workflows: ${workflows.count}`);

    console.log('\n9. Fetching funding information...');
    const funding = await fetchFunding(owner, repo);
    console.log(`   ✓ Funding links: ${funding.length}`);

    console.log('\n10. Fetching closed issues count...');
    const closedIssues = await fetchClosedIssuesCount(owner, repo);
    console.log(`   ✓ Closed issues: ${closedIssues}`);

    console.log('\n11. Fetching PR counts...');
    const prCounts = await fetchPRCounts(owner, repo);
    console.log(`   ✓ PRs - Open: ${prCounts.open}, Closed: ${prCounts.closed}`);

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
    console.error(`❌ Error:`, error.message);
    return null;
  }
}

async function updatePluginData(pluginId, githubStats) {
  const pluginsFile = path.join(__dirname, '../data/plugins.json');
  const data = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));

  const pluginIndex = data.plugins.findIndex(p => p.id === pluginId);
  if (pluginIndex === -1) {
    console.error(`\n❌ Plugin "${pluginId}" not found in plugins.json`);
    return;
  }

  data.plugins[pluginIndex].github = githubStats;
  data.lastUpdated = new Date().toISOString();

  fs.writeFileSync(pluginsFile, JSON.stringify(data, null, 2));
  console.log(`\n✅ Updated plugins.json with comprehensive GitHub stats!`);
}

async function main() {
  const owner = process.argv[2] || 'obsidian-tasks-group';
  const repo = process.argv[3] || 'obsidian-tasks';
  const pluginId = 'obsidian-tasks-plugin';

  console.log('🚀 Testing Comprehensive GitHub API Data Fetching');
  console.log('================================================\n');

  if (!GH_TOKEN) {
    console.log('⚠️  Warning: GH_TOKEN not set. Rate limits will be lower.');
  }

  const stats = await fetchComprehensiveStats(owner, repo);

  if (stats) {
    console.log('\n📊 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Repository: ${owner}/${repo}`);
    console.log(`Stars: ${stats.stars}`);
    console.log(`Forks: ${stats.forks}`);
    console.log(`Open Issues: ${stats.openIssues}`);
    console.log(`Closed Issues: ${stats.closedIssues}`);
    console.log(`Contributors: ${stats.totalContributors}`);
    console.log(`Latest Version: ${stats.currentVersion || 'N/A'}`);
    console.log(`Has CI/CD: ${stats.hasWorkflows ? 'Yes' : 'No'} (${stats.workflowCount} workflows)`);
    console.log(`Funding Links: ${stats.fundingLinks?.length || 0}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await updatePluginData(pluginId, stats);

    console.log('\n🎉 Done! Now you can:');
    console.log('1. Commit the changes to plugins.json');
    console.log('2. Push to GitHub');
    console.log('3. Vercel will automatically deploy');
    console.log('4. Visit: /plugin/obsidian-tasks-plugin to see all the data!\n');
  } else {
    console.error('\n❌ Failed to fetch comprehensive stats');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

