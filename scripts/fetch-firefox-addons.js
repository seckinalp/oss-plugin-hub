const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const FIREFOX_ADDONS_API = 'addons.mozilla.org';
const DATA_DIR = path.join(__dirname, '../data');
const FIREFOX_DIR = path.join(DATA_DIR, 'firefox');
const PLUGINS_FILE = path.join(FIREFOX_DIR, 'plugins.json');
const METADATA_FILE = path.join(FIREFOX_DIR, 'metadata.json');

// Fetch settings - configurable
const MAX_PAGES = parseInt(process.env.FIREFOX_MAX_PAGES) || 1000; // 100 pages = 10,000 addons
const PAGE_SIZE = 100; // Max allowed by API
const GITHUB_ONLY = process.env.FIREFOX_GITHUB_ONLY !== 'true'; // Default: only fetch addons with GitHub repos

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(FIREFOX_DIR)) {
  fs.mkdirSync(FIREFOX_DIR, { recursive: true });
}

/**
 * Fetch Firefox addons from the Mozilla Add-ons API
 * This uses the public Mozilla Add-ons API
 */
function fetchFirefoxAddons(pageNumber = 1, pageSize = 100) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: FIREFOX_ADDONS_API,
      path: `/api/v5/addons/search/?page=${pageNumber}&page_size=${pageSize}&sort=users&type=extension`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; PluginHub/1.0)'
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
 * Parse Firefox addon to our plugin format
 */
function parseFirefoxAddon(addon) {
  // Handle localized name - prefer English, fallback to first available
  let name = 'Unknown';
  if (typeof addon.name === 'string') {
    name = addon.name;
  } else if (addon.name && typeof addon.name === 'object') {
    name = addon.name['en-US'] || addon.name['en'] || Object.values(addon.name)[0] || 'Unknown';
  }
  
  const author = addon.authors[0]?.name || 'Unknown';
  const addonId = addon.slug;
  
  // Extract repository URL from homepage or support_url
  let repo = null;
  
  // Handle localized URLs - check homepage first, then support URL
  let urlToCheck = null;
  
  // Check homepage
  if (addon.homepage) {
    if (typeof addon.homepage === 'string') {
      urlToCheck = addon.homepage;
    } else if (typeof addon.homepage === 'object') {
      // Handle nested structure: homepage.url.en-US
      if (addon.homepage.url) {
        if (typeof addon.homepage.url === 'string') {
          urlToCheck = addon.homepage.url;
        } else if (typeof addon.homepage.url === 'object') {
          urlToCheck = addon.homepage.url['en-US'] || addon.homepage.url['en'] || Object.values(addon.homepage.url)[0];
        }
      } else {
        // Direct localized URLs
        urlToCheck = addon.homepage['en-US'] || addon.homepage['en'] || Object.values(addon.homepage)[0];
      }
    }
  }
  
  // If no homepage URL, check support URL
  if (!urlToCheck && addon.support_url) {
    if (typeof addon.support_url === 'string') {
      urlToCheck = addon.support_url;
    } else if (typeof addon.support_url === 'object') {
      // Handle nested structure: support_url.url.en-US
      if (addon.support_url.url) {
        if (typeof addon.support_url.url === 'string') {
          urlToCheck = addon.support_url.url;
        } else if (typeof addon.support_url.url === 'object') {
          urlToCheck = addon.support_url.url['en-US'] || addon.support_url.url['en'] || Object.values(addon.support_url.url)[0];
        }
      } else {
        // Direct localized URLs
        urlToCheck = addon.support_url['en-US'] || addon.support_url['en'] || Object.values(addon.support_url)[0];
      }
    }
  }
  
  if (urlToCheck && typeof urlToCheck === 'string') {
    // Extract owner/repo from GitHub URL
    const match = urlToCheck.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (match) {
      repo = match[1].replace(/\.git$/, '').split('#')[0]; // Remove fragment part
    }
  }

  // Get statistics
  const users = addon.average_daily_users || 0;
  const rating = addon.ratings?.average || 0;
  const ratingCount = addon.ratings?.count || 0;

  // Handle localized description - prefer English, fallback to first available
  let description = '';
  if (typeof addon.summary === 'string') {
    description = addon.summary;
  } else if (addon.summary && typeof addon.summary === 'object') {
    description = addon.summary['en-US'] || addon.summary['en'] || Object.values(addon.summary)[0] || '';
  }

  return {
    id: addonId.toLowerCase(),
    name: name,
    author: author,
    description: description,
    repo: repo,
    platform: 'firefox',
    addonId: addonId,
    publishedDate: addon.created,
    lastUpdated: addon.last_updated,
    downloadUrl: `https://addons.mozilla.org/en-US/firefox/addon/${addonId}/`,
    users: users,
    rating: rating,
    ratingCount: ratingCount,
    categories: addon.categories ? Object.values(addon.categories) : [],
    tags: addon.tags || [],
    homepage: addon.homepage,
    supportUrl: addon.support_url
  };
}

/**
 * Fetch multiple pages of addons
 */
async function fetchAllFirefoxAddons(maxPages = 10, pageSize = 100) {
  const allAddons = [];
  
  console.log(`📥 Fetching Firefox addons (up to ${maxPages} pages)...`);
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      console.log(`   Fetching page ${page}/${maxPages}...`);
      const result = await fetchFirefoxAddons(page, pageSize);
      
      if (result.results && result.results.length > 0) {
        const addons = result.results;
        
        if (addons.length === 0) {
          console.log('   No more addons found');
          break;
        }
        
        allAddons.push(...addons);
        console.log(`   ✓ Fetched ${addons.length} addons`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('   No more addons found');
        break;
      }
    } catch (error) {
      console.error(`   ⚠️  Error fetching page ${page}:`, error.message);
      break;
    }
  }
  
  return allAddons;
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(firefoxPlugins) {
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
  const mergedPlugins = firefoxPlugins.map(plugin => {
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
    platform: 'firefox',
    totalCount: mergedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalUsers: mergedPlugins.reduce((sum, p) => sum + (p.users || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      averageRating: mergedPlugins.filter(p => p.rating).length > 0
        ? mergedPlugins.filter(p => p.rating).reduce((sum, p) => sum + p.rating, 0) / mergedPlugins.filter(p => p.rating).length
        : 0,
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
  console.log('🚀 Starting Firefox addon fetch...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - Max pages: ${MAX_PAGES} (fetching up to ${MAX_PAGES * PAGE_SIZE} addons)`);
  console.log(`   - Page size: ${PAGE_SIZE}`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'} (${GITHUB_ONLY ? 'will filter to addons with GitHub repos' : 'will include all addons'})`);
  console.log(`   - Set FIREFOX_MAX_PAGES env var to limit pages (default: 100)`);
  console.log(`   - Set FIREFOX_GITHUB_ONLY=false to include addons without GitHub repos\n`);
  
  try {
    // Fetch Firefox addons
    const rawAddons = await fetchAllFirefoxAddons(MAX_PAGES, PAGE_SIZE);
    console.log(`\n✓ Fetched ${rawAddons.length} total Firefox addons\n`);
    
    // Parse to our format
    console.log('🔄 Parsing addons...');
    const allParsedPlugins = rawAddons.map(parseFirefoxAddon);
    
    // Filter based on GitHub-only setting
    let firefoxPlugins;
    if (GITHUB_ONLY) {
      firefoxPlugins = allParsedPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${allParsedPlugins.length} addons`);
      console.log(`   - With GitHub repos: ${firefoxPlugins.length} (kept)`);
      console.log(`   - Without GitHub repos: ${allParsedPlugins.length - firefoxPlugins.length} (filtered out)\n`);
    } else {
      firefoxPlugins = allParsedPlugins;
      const withRepos = firefoxPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${firefoxPlugins.length} addons`);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${firefoxPlugins.length - withRepos.length}\n`);
    }
    
    // Show top 10 by users
    console.log('📊 Top 10 Firefox addons by users:');
    const sorted = [...firefoxPlugins].sort((a, b) => b.users - a.users).slice(0, 10);
    sorted.forEach((addon, i) => {
      const users = (addon.users / 1000000).toFixed(1) + 'M';
      console.log(`   ${i + 1}. ${addon.name} by ${addon.author} (${users} users)`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving plugins and metadata...');
    const result = savePluginsAndMetadata(firefoxPlugins);
    
    console.log(`✓ Saved to ${FIREFOX_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} addons)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Firefox Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total users: ${(result.metadata.stats.totalUsers / 1000000).toFixed(1)}M`);
    console.log('\n✅ Firefox addon fetch completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error fetching Firefox addons:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
