const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const PACKAGE_CONTROL_API = 'packagecontrol.io';
const DATA_DIR = path.join(__dirname, '../data');
const SUBLIME_DIR = path.join(DATA_DIR, 'sublime');
const PLUGINS_FILE = path.join(SUBLIME_DIR, 'plugins.json');
const METADATA_FILE = path.join(SUBLIME_DIR, 'metadata.json');

// Fetch settings - configurable
const GITHUB_ONLY = process.env.SUBLIME_GITHUB_ONLY !== 'false'; // Default: only fetch packages with GitHub repos

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SUBLIME_DIR)) {
  fs.mkdirSync(SUBLIME_DIR, { recursive: true });
}

/**
 * Fetch Sublime Text packages from Package Control
 * This uses the public Package Control API
 */
function fetchSublimePackages() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PACKAGE_CONTROL_API,
      path: '/channel_v3.json',
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Parse Sublime Text package to our plugin format
 */
function parseSublimePackage(packageName, packageData) {
  const name = packageData.name || packageName;
  const author = packageData.author || 'Unknown';
  const description = packageData.description || '';
  
  // Extract repository URL from various sources
  let repo = null;
  
  // Check for GitHub repository in various fields
  const repoFields = [
    packageData.homepage,
    packageData.repository,
    packageData.source,
    packageData.url
  ];
  
  for (const field of repoFields) {
    if (field && typeof field === 'string') {
      // Extract owner/repo from GitHub URL
      const match = field.match(/github\.com\/([^\/]+\/[^\/]+)/);
      if (match) {
        repo = match[1].replace(/\.git$/, '');
        break;
      }
    }
  }
  
  // If no GitHub repo found in URLs, check if the package name suggests a GitHub repo
  if (!repo && packageData.repository && packageData.repository.includes('github.com')) {
    const match = packageData.repository.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (match) {
      repo = match[1].replace(/\.git$/, '');
    }
  }

  // Get download count if available
  const downloads = packageData.downloads || 0;
  
  // Get last updated date
  const lastUpdated = packageData.last_modified || null;
  
  // Get package categories/tags
  const categories = packageData.categories || [];
  const tags = packageData.tags || [];

  return {
    id: packageName.toLowerCase(),
    name: name,
    author: author,
    description: description,
    repo: repo,
    platform: 'sublime',
    packageName: packageName,
    lastUpdated: lastUpdated,
    downloadUrl: `https://packagecontrol.io/packages/${packageName}`,
    downloads: downloads,
    categories: categories,
    tags: tags,
    homepage: packageData.homepage || null,
    repository: packageData.repository || null
  };
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(sublimePlugins) {
  // Load existing plugins to preserve GitHub stats
  let existingPlugins = [];
  if (fs.existsSync(PLUGINS_FILE)) {
    const existing = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
    existingPlugins = existing.plugins || [];
  }
  
  // Create map of existing plugins with GitHub stats
  const existingMap = new Map();
  existingPlugins.forEach(p => existingMap.set(p.id, p));
  
  // Merge: keep GitHub stats from existing plugins
  const mergedPlugins = sublimePlugins.map(plugin => {
    const existing = existingMap.get(plugin.id);
    if (existing && existing.githubStats) {
      return {
        ...plugin,
        githubStats: existing.githubStats,
        githubDataFetchedAt: existing.githubDataFetchedAt
      };
    }
    return plugin;
  });
  
  // Create metadata
  const pluginsWithStats = mergedPlugins.filter(p => p.githubStats);
  const pluginsWithRepos = mergedPlugins.filter(p => p.repo);
  const metadata = {
    platform: 'sublime',
    totalCount: mergedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalDownloads: mergedPlugins.reduce((sum, p) => sum + (p.downloads || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
    }
  };
  
  // Save files
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: mergedPlugins }, null, 2));
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  
  return { plugins: mergedPlugins, metadata };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Sublime Text package fetch...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'} (${GITHUB_ONLY ? 'will filter to packages with GitHub repos' : 'will include all packages'})`);
  console.log(`   - Set SUBLIME_GITHUB_ONLY=false to include packages without GitHub repos\n`);
  
  try {
    // Fetch Sublime Text packages
    console.log('📥 Fetching Sublime Text packages from Package Control...');
    const rawData = await fetchSublimePackages();
    
    if (!rawData.packages_cache) {
      throw new Error('No packages_cache found in API response');
    }
    
    // Extract all packages from all repositories in packages_cache
    const allPackages = [];
    Object.values(rawData.packages_cache).forEach(repoPackages => {
      if (Array.isArray(repoPackages)) {
        allPackages.push(...repoPackages);
      }
    });
    
    console.log(`✓ Fetched ${allPackages.length} total Sublime Text packages\n`);
    
    // Parse to our format
    console.log('🔄 Parsing packages...');
    const allParsedPlugins = allPackages.map(packageData => 
      parseSublimePackage(packageData.name, packageData)
    );
    
    // Filter based on GitHub-only setting
    let sublimePlugins;
    if (GITHUB_ONLY) {
      sublimePlugins = allParsedPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${allParsedPlugins.length} packages`);
      console.log(`   - With GitHub repos: ${sublimePlugins.length} (kept)`);
      console.log(`   - Without GitHub repos: ${allParsedPlugins.length - sublimePlugins.length} (filtered out)\n`);
    } else {
      sublimePlugins = allParsedPlugins;
      const withRepos = sublimePlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${sublimePlugins.length} packages`);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${sublimePlugins.length - withRepos.length}\n`);
    }
    
    // Show top 10 by downloads
    console.log('📊 Top 10 Sublime Text packages by downloads:');
    const sorted = [...sublimePlugins].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 10);
    sorted.forEach((pkg, i) => {
      const downloads = pkg.downloads ? (pkg.downloads / 1000).toFixed(1) + 'K' : 'N/A';
      console.log(`   ${i + 1}. ${pkg.name} by ${pkg.author} (${downloads} downloads)`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving packages and metadata...');
    const result = savePluginsAndMetadata(sublimePlugins);
    
    console.log(`✓ Saved to ${SUBLIME_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} packages)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Sublime Text Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total downloads: ${(result.metadata.stats.totalDownloads / 1000).toFixed(1)}K`);
    console.log('\n✅ Sublime Text package fetch completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error fetching Sublime Text packages:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
