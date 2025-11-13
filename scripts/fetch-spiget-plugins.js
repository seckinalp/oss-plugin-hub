const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const SPIGET_API_BASE = 'api.spiget.org';
const DATA_DIR = path.join(__dirname, '../data');
const MINECRAFT_DIR = path.join(DATA_DIR, 'minecraft');
const PLUGINS_FILE = path.join(MINECRAFT_DIR, 'plugins.json');
const METADATA_FILE = path.join(MINECRAFT_DIR, 'metadata.json');

// Fetch settings - configurable
const MAX_PAGES = parseInt(process.env.SPIGET_MAX_PAGES) || 30; // 30 pages = 3,000 plugins
const PAGE_SIZE = 100; // Max allowed by API
const GITHUB_ONLY = process.env.SPIGET_GITHUB_ONLY !== 'false'; // Default: only fetch plugins with GitHub repos

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(MINECRAFT_DIR)) {
  fs.mkdirSync(MINECRAFT_DIR, { recursive: true });
}

/**
 * Fetch plugins from Spiget API
 * Uses the v2 API endpoints
 */
function fetchSpigetPlugins(size = 100, page = 0, sort = '-downloads') {
  return new Promise((resolve, reject) => {
    const searchParams = new URLSearchParams({
      size: size.toString(),
      page: page.toString(),
      sort: sort
    });

    const options = {
      hostname: SPIGET_API_BASE,
      path: `/v2/resources?${searchParams}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0 (Minecraft Plugin Fetcher)',
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
 * Fetch detailed plugin information from Spiget
 */
function fetchSpigetPlugin(pluginId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SPIGET_API_BASE,
      path: `/v2/resources/${pluginId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0 (Minecraft Plugin Fetcher)',
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
 * Fetch plugin author information
 */
function fetchSpigetAuthor(authorId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SPIGET_API_BASE,
      path: `/v2/authors/${authorId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0 (Minecraft Plugin Fetcher)',
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
 * Parse Spiget plugin to our plugin format
 */
function parseSpigetPlugin(plugin) {
  // Extract GitHub repository from external links
  let repo = null;
  if (plugin.external) {
    const githubLink = plugin.external.find(link => 
      link.includes('github.com')
    );
    if (githubLink) {
      const match = githubLink.match(/github\.com\/([^\/]+\/[^\/]+)/);
      if (match) {
        repo = match[1].replace(/\.git$/, '');
      }
    }
  }

  // Determine server platform
  let loader = 'spigot';
  if (plugin.category && plugin.category.name) {
    const categoryName = plugin.category.name.toLowerCase();
    if (categoryName.includes('paper')) {
      loader = 'paper';
    } else if (categoryName.includes('bukkit')) {
      loader = 'bukkit';
    }
  }

  // Extract Minecraft versions from tested versions
  const minecraftVersions = plugin.testedVersions || [];

  return {
    id: `spiget-${plugin.id}`,
    name: plugin.name,
    author: plugin.author ? plugin.author.name : 'Unknown',
    description: plugin.description || '',
    repo: repo,
    platform: 'minecraft',
    modType: 'server',
    loader: loader,
    minecraftVersions: minecraftVersions,
    downloadCount: plugin.downloads || 0,
    rating: plugin.rating ? plugin.rating.average : 0,
    ratingCount: plugin.rating ? plugin.rating.count : 0,
    categories: plugin.category ? [plugin.category.name] : [],
    tags: plugin.tag ? [plugin.tag] : [],
    source: 'spiget',
    sourceId: plugin.id.toString(),
    downloadUrl: plugin.file ? `https://www.spigotmc.org/resources/${plugin.id}/download` : `https://www.spigotmc.org/resources/${plugin.id}`,
    projectUrl: `https://www.spigotmc.org/resources/${plugin.id}`,
    publishedDate: plugin.date ? new Date(plugin.date).toISOString() : null,
    lastUpdated: plugin.updateDate ? new Date(plugin.updateDate).toISOString() : null
  };
}

/**
 * Fetch multiple pages of plugins
 */
async function fetchAllSpigetPlugins(maxPages = 10, pageSize = 100) {
  const allPlugins = [];
  
  console.log(`📥 Fetching Spiget plugins (up to ${maxPages} pages)...`);
  
  for (let page = 0; page < maxPages; page++) {
    try {
      console.log(`   Fetching page ${page + 1}/${maxPages}...`);
      
      const result = await fetchSpigetPlugins(pageSize, page, '-downloads');
      
      if (result && result.length > 0) {
        allPlugins.push(...result);
        console.log(`   ✓ Fetched ${result.length} plugins`);
        
        // If we got fewer results than requested, we've reached the end
        if (result.length < pageSize) {
          console.log('   No more plugins found');
          break;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('   No more plugins found');
        break;
      }
    } catch (error) {
      console.error(`   ⚠️  Error fetching page ${page + 1}:`, error.message);
      break;
    }
  }
  
  return allPlugins;
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(minecraftPlugins) {
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
  const mergedPlugins = minecraftPlugins.map(plugin => {
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
  
  // Deduplicate by GitHub repo: keep one entry per unique GitHub repository
  const deduplicatedPlugins = [];
  const repoMap = new Map();
  
  for (const plugin of mergedPlugins) {
    if (plugin.repo) {
      const existing = repoMap.get(plugin.repo);
      if (existing) {
        // Merge sources if the same repo appears on multiple platforms
        if (!existing.sources) {
          existing.sources = [existing.source];
        }
        if (existing.source && !existing.sources.includes(existing.source)) {
          existing.sources.push(existing.source);
        }
        if (plugin.source && !existing.sources.includes(plugin.source)) {
          existing.sources.push(plugin.source);
        }
        // Keep the one with more data (GitHub stats, etc.)
        if (plugin.githubStats && !existing.githubStats) {
          Object.assign(existing, plugin);
        }
      } else {
        repoMap.set(plugin.repo, { ...plugin, sources: plugin.source ? [plugin.source] : [] });
        deduplicatedPlugins.push(repoMap.get(plugin.repo));
      }
    } else {
      // Plugins without GitHub repos are kept as-is
      deduplicatedPlugins.push(plugin);
    }
  }
  
  const finalPlugins = deduplicatedPlugins.length > 0 ? deduplicatedPlugins : mergedPlugins;
  
  // Create metadata
  const pluginsWithStats = finalPlugins.filter(p => p.githubStats);
  const pluginsWithRepos = finalPlugins.filter(p => p.repo);
  
  // Calculate stats by mod type and loader
  const modTypes = { client: 0, server: 0, both: 0 };
  const loaders = { fabric: 0, forge: 0, quilt: 0, spigot: 0, paper: 0, bukkit: 0 };
  const sources = { modrinth: 0, curseforge: 0, spiget: 0 };
  
  finalPlugins.forEach(plugin => {
    if (plugin.modType) modTypes[plugin.modType]++;
    if (plugin.loader) loaders[plugin.loader]++;
    if (plugin.source) sources[plugin.source]++;
  });
  
  const metadata = {
    platform: 'minecraft',
    totalCount: finalPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalDownloads: finalPlugins.reduce((sum, p) => sum + (p.downloadCount || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      averageRating: finalPlugins.filter(p => p.rating).length > 0
        ? finalPlugins.filter(p => p.rating).reduce((sum, p) => sum + p.rating, 0) / finalPlugins.filter(p => p.rating).length
        : 0,
      modTypes: modTypes,
      loaders: loaders,
      sources: sources
    }
  };
  
  // Save files
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: finalPlugins }, null, 2));
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  
  return { plugins: finalPlugins, metadata };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Spiget plugin fetch...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - Max pages: ${MAX_PAGES} (fetching up to ${MAX_PAGES * PAGE_SIZE} plugins)`);
  console.log(`   - Page size: ${PAGE_SIZE}`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'} (${GITHUB_ONLY ? 'will filter to plugins with GitHub repos' : 'will include all plugins'})`);
  console.log(`   - Set SPIGET_MAX_PAGES env var to limit pages (default: 30)`);
  console.log(`   - Set SPIGET_GITHUB_ONLY=false to include plugins without GitHub repos\n`);
  
  try {
    // Fetch Spiget plugins
    const rawPlugins = await fetchAllSpigetPlugins(MAX_PAGES, PAGE_SIZE);
    console.log(`\n✓ Fetched ${rawPlugins.length} total Spiget plugins\n`);
    
    // Parse to our format
    console.log('🔄 Parsing plugins...');
    const allParsedPlugins = rawPlugins.map(parseSpigetPlugin);
    
    // Filter based on GitHub-only setting
    let minecraftPlugins;
    if (GITHUB_ONLY) {
      minecraftPlugins = allParsedPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${allParsedPlugins.length} plugins`);
      console.log(`   - With GitHub repos: ${minecraftPlugins.length} (kept)`);
      console.log(`   - Without GitHub repos: ${allParsedPlugins.length - minecraftPlugins.length} (filtered out)\n`);
    } else {
      minecraftPlugins = allParsedPlugins;
      const withRepos = minecraftPlugins.filter(p => p.repo !== null);
      console.log(`✓ Parsed ${minecraftPlugins.length} plugins`);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${minecraftPlugins.length - withRepos.length}\n`);
    }
    
    // Show top 10 by downloads
    console.log('📊 Top 10 Spiget plugins by downloads:');
    const sorted = [...minecraftPlugins].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 10);
    sorted.forEach((plugin, i) => {
      const downloads = (plugin.downloadCount / 1000000).toFixed(1) + 'M';
      console.log(`   ${i + 1}. ${plugin.name} by ${plugin.author} (${downloads} downloads, ${plugin.loader})`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving plugins and metadata...');
    const result = savePluginsAndMetadata(minecraftPlugins);
    
    console.log(`✓ Saved to ${MINECRAFT_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} plugins)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Minecraft Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total downloads: ${(result.metadata.stats.totalDownloads / 1000000).toFixed(1)}M`);
    console.log(`   - Mod types: Client: ${result.metadata.stats.modTypes.client}, Server: ${result.metadata.stats.modTypes.server}, Both: ${result.metadata.stats.modTypes.both}`);
    console.log(`   - Loaders: Fabric: ${result.metadata.stats.loaders.fabric}, Forge: ${result.metadata.stats.loaders.forge}, Quilt: ${result.metadata.stats.loaders.quilt}`);
    console.log(`   - Server platforms: Spigot: ${result.metadata.stats.loaders.spigot}, Paper: ${result.metadata.stats.loaders.paper}, Bukkit: ${result.metadata.stats.loaders.bukkit}`);
    console.log('\n✅ Spiget plugin fetch completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error fetching Spiget plugins:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
