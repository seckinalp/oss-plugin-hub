const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const JETBRAINS_API_BASE = 'plugins.jetbrains.com';
const DATA_DIR = path.join(__dirname, '../data');
const JETBRAINS_DIR = path.join(DATA_DIR, 'jetbrains');
const PLUGINS_FILE = path.join(JETBRAINS_DIR, 'plugins.json');
const METADATA_FILE = path.join(JETBRAINS_DIR, 'metadata.json');

// Fetch settings - configurable
const PAGE_SIZE = parseInt(process.env.JETBRAINS_PAGE_SIZE) || 20; // Plugins per page (JetBrains API limit ~20-25)
const GITHUB_ONLY = process.env.JETBRAINS_GITHUB_ONLY !== 'false'; // Default: only fetch plugins with GitHub repos

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(JETBRAINS_DIR)) {
  fs.mkdirSync(JETBRAINS_DIR, { recursive: true });
}

/**
 * Fetch JetBrains plugins using the search API with pagination
 */
function fetchJetBrainsPluginsPage(offset = 0, max = 100) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      'query': '', // Empty query to get all plugins
      'max': max.toString(),
      'offset': offset.toString()
    });

    const options = {
      hostname: JETBRAINS_API_BASE,
      path: `/api/searchPlugins?${params.toString()}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0',
        'Accept': 'application/json'
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
            reject(new Error(`Failed to parse JSON for offset ${offset}: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode} for offset ${offset}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout for offset ${offset}`));
    });

    req.end();
  });
}

/**
 * Fetch detailed plugin information by ID
 */
function fetchJetBrainsPluginDetails(pluginId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: JETBRAINS_API_BASE,
      path: `/api/plugins/${pluginId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0',
        'Accept': 'application/json'
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
            reject(new Error(`Failed to parse JSON for plugin ${pluginId}: ${error.message}`));
          }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for plugin ${pluginId}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error(`Timeout for plugin ${pluginId}`));
    });

    req.end();
  });
}

/**
 * Extract GitHub repository from sourceCodeUrl
 */
function extractGitHubRepo(plugin) {
  if (!plugin.urls || !plugin.urls.sourceCodeUrl) {
    return null;
  }

  const sourceCodeUrl = plugin.urls.sourceCodeUrl;
  
  // Check for GitHub URLs
  const githubMatch = sourceCodeUrl.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)/);
  if (githubMatch) {
    return `${githubMatch[1]}/${githubMatch[2]}`.replace(/\.git$/, '');
  }
  
  return null;
}

/**
 * Parse JetBrains plugin to our plugin format
 */
function parseJetBrainsPlugin(plugin) {
  const name = plugin.name || 'Unknown Plugin';
  const xmlId = plugin.xmlId || '';
  const vendor = plugin.vendor ? 
    (typeof plugin.vendor === 'string' ? plugin.vendor : plugin.vendor.name) : 
    'Unknown Author';
  
  // Extract GitHub repository
  const repo = extractGitHubRepo(plugin);
  
  // Get statistics
  const downloads = plugin.downloads || 0;
  
  // Extract tags (filter out null values)
  const tags = plugin.tags ? plugin.tags.filter(tag => tag !== null).map(tag => tag.name || tag) : [];
  
  // Clean description (remove HTML tags)
  const description = plugin.description ? 
    plugin.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

  return {
    id: xmlId.toLowerCase() || plugin.id.toString(),
    name: name,
    author: vendor,
    description: description,
    repo: repo,
    platform: 'jetbrains',
    pluginId: plugin.id,
    xmlId: xmlId,
    downloads: downloads,
    downloadUrl: `https://plugins.jetbrains.com/plugin/${plugin.id}`,
    vendorUrl: plugin.vendorUrl || '',
    tags: tags,
    family: plugin.family || '',
    pricingModel: plugin.pricingModel || 'FREE',
    lastUpdated: plugin.cdate ? new Date(plugin.cdate).toISOString() : null
  };
}

/**
 * Fetch ALL JetBrains plugins using infinite pagination until 404 or empty response
 */
async function fetchAllJetBrainsPlugins(pageSize = 20) {
  const allPlugins = [];
  let page = 0;
  let totalFetched = 0;
  
  console.log(`📥 Fetching ALL JetBrains plugins (${pageSize} per page, continuing until no more plugins)...`);
  
  while (true) {
    const offset = page * pageSize;
    
    try {
      console.log(`   Fetching page ${page + 1} (offset ${offset})...`);
      const response = await fetchJetBrainsPluginsPage(offset, pageSize);
      
      // Check if we got a valid response with plugins
      if (!response || !response.plugins || !Array.isArray(response.plugins) || response.plugins.length === 0) {
        console.log('   ✅ No more plugins found - reached end of results');
        break;
      }
      
      console.log(`   ✓ Fetched ${response.plugins.length} plugins from search API`);
      totalFetched += response.plugins.length;
      
      // Filter plugins that have source code
      const pluginsWithSource = response.plugins.filter(plugin => plugin.hasSource === true);
      console.log(`   📋 ${pluginsWithSource.length} plugins have source code available`);
      
      // Fetch detailed information for plugins with source code
      if (pluginsWithSource.length > 0) {
        console.log(`   🔍 Fetching detailed info for plugins with source...`);
        for (const plugin of pluginsWithSource) {
          try {
            const detailedPlugin = await fetchJetBrainsPluginDetails(plugin.id);
            if (detailedPlugin) {
              // Merge search result with detailed info
              const mergedPlugin = {
                ...plugin,
                ...detailedPlugin
              };
              allPlugins.push(mergedPlugin);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.log(`   ⚠️  Error fetching details for plugin ${plugin.id}: ${error.message}`);
          }
        }
      }
      
      // If we got fewer plugins than requested, we've reached the end
      if (response.plugins.length < pageSize) {
        console.log('   ✅ Reached end of results (partial page)');
        break;
      }
      
      page++;
      
      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`   ⚠️  Error fetching page ${page + 1}:`, error.message);
      break;
    }
  }
  
  console.log(`\n📊 Pagination complete: Fetched ${totalFetched} total plugins, ${allPlugins.length} with GitHub repos`);
  return allPlugins;
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(jetbrainsPlugins) {
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
  const mergedPlugins = jetbrainsPlugins.map(plugin => {
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
    platform: 'jetbrains',
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
  console.log('🚀 Starting JetBrains plugin fetch...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - Page size: ${PAGE_SIZE} (JetBrains API limit ~20-25)`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'} (${GITHUB_ONLY ? 'will filter to plugins with GitHub repos' : 'will include all plugins'})`);
  console.log(`   - Infinite pagination: Will fetch ALL available plugins until API returns empty`);
  console.log(`   - Set JETBRAINS_PAGE_SIZE env var to change page size`);
  console.log(`   - Set JETBRAINS_GITHUB_ONLY=false to include plugins without GitHub repos\n`);
  
  try {
    // Fetch JetBrains plugins using infinite pagination
    const rawPlugins = await fetchAllJetBrainsPlugins(PAGE_SIZE);
    console.log(`\n✓ Fetched ${rawPlugins.length} total JetBrains plugins with GitHub repos\n`);
    
    // Parse to our format
    console.log('🔄 Parsing plugins...');
    const allParsedPlugins = rawPlugins.map(parseJetBrainsPlugin);
    
    // Filter based on GitHub-only setting
    let jetbrainsPlugins;
    if (GITHUB_ONLY) {
      jetbrainsPlugins = allParsedPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${allParsedPlugins.length} plugins`);
      console.log(`   - With GitHub repos: ${jetbrainsPlugins.length} (kept)`);
      console.log(`   - Without GitHub repos: ${allParsedPlugins.length - jetbrainsPlugins.length} (filtered out)\n`);
    } else {
      jetbrainsPlugins = allParsedPlugins;
      const withRepos = jetbrainsPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${jetbrainsPlugins.length} plugins`);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${jetbrainsPlugins.length - withRepos.length}\n`);
    }
    
    // Show top 10 by downloads
    console.log('📊 Top 10 JetBrains plugins by downloads:');
    const sorted = [...jetbrainsPlugins].sort((a, b) => b.downloads - a.downloads).slice(0, 10);
    sorted.forEach((plugin, i) => {
      const downloads = (plugin.downloads / 1000000).toFixed(1) + 'M';
      console.log(`   ${i + 1}. ${plugin.name} by ${plugin.author} (${downloads} downloads)`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving plugins and metadata...');
    const result = savePluginsAndMetadata(jetbrainsPlugins);
    
    console.log(`✓ Saved to ${JETBRAINS_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} plugins)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 JetBrains Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total downloads: ${(result.metadata.stats.totalDownloads / 1000000).toFixed(1)}M`);
    console.log('\n✅ JetBrains plugin fetch completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error fetching JetBrains plugins:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
