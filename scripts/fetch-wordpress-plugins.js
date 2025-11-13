const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const WORDPRESS_API_BASE = 'api.wordpress.org';
const WORDPRESS_API_PATH = '/plugins/info/1.2/';
const DATA_DIR = path.join(__dirname, '../data');
const WORDPRESS_DIR = path.join(DATA_DIR, 'wordpress');
const PLUGINS_FILE = path.join(WORDPRESS_DIR, 'plugins.json');
const METADATA_FILE = path.join(WORDPRESS_DIR, 'metadata.json');

// Fetch settings - configurable
// Note: WordPress has 60,000+ plugins total
// Set to fetch ALL plugins with pagination
const MAX_PAGES = parseInt(process.env.WORDPRESS_MAX_PAGES) || 600; // 600 pages = 60,000 plugins (all)
const PAGE_SIZE = 700; // Max allowed by API
const GITHUB_ONLY = process.env.WORDPRESS_GITHUB_ONLY !== 'false'; // Default: only fetch plugins with GitHub repos

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(WORDPRESS_DIR)) {
  fs.mkdirSync(WORDPRESS_DIR, { recursive: true });
}

/**
 * Fetch WordPress plugins from the official API
 * Uses pagination to get all plugins
 */
function fetchWordPressPlugins(pageNumber = 1, pageSize = 100) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      'action': 'query_plugins',
      'request[page]': pageNumber.toString(),
      'request[per_page]': pageSize.toString(),
      'request[fields]': 'name,slug,version,author,homepage,description,download_link,last_updated,requires,tested,rating,ratings,num_ratings,active_installs,tags,categories'
    });

    const options = {
      hostname: WORDPRESS_API_BASE,
      path: WORDPRESS_API_PATH + '?' + params.toString(),
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
 * Extract GitHub repository from homepage or author URL
 */
function extractGitHubRepo(plugin) {
  const urls = [plugin.homepage, plugin.author];
  
  for (const url of urls) {
    if (!url) continue;
    
    // Clean up HTML tags if present
    const cleanUrl = url.replace(/<[^>]*>/g, '');
    
    // Check for GitHub URLs
    const githubMatch = cleanUrl.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
    if (githubMatch) {
      return `${githubMatch[1]}/${githubMatch[2]}`.replace(/\.git$/, '');
    }
    
    // Check for GitHub.io or GitHub pages
    const githubIoMatch = cleanUrl.match(/([^\/\s]+)\.github\.io/);
    if (githubIoMatch) {
      return `${githubIoMatch[1]}/${githubIoMatch[1]}`;
    }
  }
  
  return null;
}

/**
 * Parse WordPress plugin to our plugin format
 */
function parseWordPressPlugin(plugin) {
  const name = plugin.name || 'Unknown Plugin';
  const slug = plugin.slug || '';
  const author = plugin.author ? plugin.author.replace(/<[^>]*>/g, '') : 'Unknown Author';
  
  // Extract GitHub repository
  const repo = extractGitHubRepo(plugin);
  
  // Get statistics
  const activeInstalls = plugin.active_installs || 0;
  const rating = plugin.rating || 0;
  const ratingCount = plugin.num_ratings || 0;
  
  // Extract tags and categories
  const tags = plugin.tags ? Object.keys(plugin.tags) : [];
  const categories = plugin.categories ? Object.keys(plugin.categories) : [];

  return {
    id: slug.toLowerCase(),
    name: name,
    author: author,
    description: plugin.description || '',
    repo: repo,
    platform: 'wordpress',
    slug: slug,
    version: plugin.version || '',
    homepage: plugin.homepage || '',
    downloadUrl: plugin.download_link || '',
    lastUpdated: plugin.last_updated || '',
    requires: plugin.requires || '',
    tested: plugin.tested || '',
    activeInstalls: activeInstalls,
    rating: rating,
    ratingCount: ratingCount,
    tags: tags,
    categories: categories
  };
}

/**
 * Fetch multiple pages of plugins
 */
async function fetchAllWordPressPlugins(maxPages = 10, pageSize = 100) {
  const allPlugins = [];
  
  console.log(`📥 Fetching WordPress plugins (up to ${maxPages} pages)...`);
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      console.log(`   Fetching page ${page}/${maxPages}...`);
      const result = await fetchWordPressPlugins(page, pageSize);
      
      if (result.plugins && Array.isArray(result.plugins)) {
        if (result.plugins.length === 0) {
          console.log('   No more plugins found');
          break;
        }
        
        allPlugins.push(...result.plugins);
        console.log(`   ✓ Fetched ${result.plugins.length} plugins`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('   No plugins in response');
        break;
      }
    } catch (error) {
      console.error(`   ⚠️  Error fetching page ${page}:`, error.message);
      break;
    }
  }
  
  return allPlugins;
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(wordpressPlugins) {
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
  const mergedPlugins = wordpressPlugins.map(plugin => {
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
    platform: 'wordpress',
    totalCount: mergedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalActiveInstalls: mergedPlugins.reduce((sum, p) => sum + (p.activeInstalls || 0), 0),
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
  console.log('🚀 Starting WordPress plugin fetch...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - Max pages: ${MAX_PAGES} (fetching up to ${MAX_PAGES * PAGE_SIZE} plugins)`);
  console.log(`   - Page size: ${PAGE_SIZE}`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'} (${GITHUB_ONLY ? 'will filter to plugins with GitHub repos' : 'will include all plugins'})`);
  console.log(`   - Note: WordPress has 60,000+ total plugins`);
  console.log(`   - Set WORDPRESS_MAX_PAGES env var to limit pages (default: 600 for all)`);
  console.log(`   - Set WORDPRESS_GITHUB_ONLY=false to include plugins without GitHub repos\n`);
  
  try {
    // Fetch WordPress plugins
    const rawPlugins = await fetchAllWordPressPlugins(MAX_PAGES, PAGE_SIZE);
    console.log(`\n✓ Fetched ${rawPlugins.length} total WordPress plugins\n`);
    
    // Parse to our format
    console.log('🔄 Parsing plugins...');
    const allParsedPlugins = rawPlugins.map(parseWordPressPlugin);
    
    // Filter based on GitHub-only setting
    let wordpressPlugins;
    if (GITHUB_ONLY) {
      wordpressPlugins = allParsedPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${allParsedPlugins.length} plugins`);
      console.log(`   - With GitHub repos: ${wordpressPlugins.length} (kept)`);
      console.log(`   - Without GitHub repos: ${allParsedPlugins.length - wordpressPlugins.length} (filtered out)\n`);
    } else {
      wordpressPlugins = allParsedPlugins;
      const withRepos = wordpressPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${wordpressPlugins.length} plugins`);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${wordpressPlugins.length - withRepos.length}\n`);
    }
    
    // Show top 10 by active installs
    console.log('📊 Top 10 WordPress plugins by active installs:');
    const sorted = [...wordpressPlugins].sort((a, b) => b.activeInstalls - a.activeInstalls).slice(0, 10);
    sorted.forEach((plugin, i) => {
      const installs = (plugin.activeInstalls / 1000000).toFixed(1) + 'M';
      console.log(`   ${i + 1}. ${plugin.name} by ${plugin.author} (${installs} installs)`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving plugins and metadata...');
    const result = savePluginsAndMetadata(wordpressPlugins);
    
    console.log(`✓ Saved to ${WORDPRESS_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} plugins)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 WordPress Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total active installs: ${(result.metadata.stats.totalActiveInstalls / 1000000).toFixed(1)}M`);
    console.log('\n✅ WordPress plugin fetch completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error fetching WordPress plugins:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
