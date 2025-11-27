import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DATA_DIR = path.join(__dirname, '../data');

// Data sources for download stats
const DOWNLOAD_STATS_SOURCES = {
  obsidian: 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json',
  // Other platforms will be added as we implement them
};

/**
 * Fetch JSON data from a URL
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Fetch download stats for Obsidian plugins
 */
async function fetchObsidianDownloadStats() {
  console.log('📥 Fetching Obsidian download stats...');
  const stats = await fetchJSON(DOWNLOAD_STATS_SOURCES.obsidian);
  
  // Stats format: { "plugin-id": { downloads: number } }
  const downloadMap = new Map();
  for (const [pluginId, data] of Object.entries(stats)) {
    downloadMap.set(pluginId, {
      downloads: data.downloads || 0,
      updatedDate: data.updated || null
    });
  }
  
  console.log(`✓ Fetched stats for ${downloadMap.size} Obsidian plugins\n`);
  return downloadMap;
}

/**
 * VS Code plugins already have install data - just return empty map
 * The data is already in the plugins, we just need to normalize it
 */
async function fetchVSCodeDownloadStats() {
  console.log('ℹ️  VS Code installs already in plugin data\n');
  return new Map(); // Return empty - data already exists
}

/**
 * Minecraft plugins already have downloadCount - just return empty map
 */
async function fetchMinecraftDownloadStats() {
  console.log('ℹ️  Minecraft downloads already in plugin data\n');
  return new Map(); // Return empty - data already exists
}

/**
 * Firefox addons already have users data - just return empty map
 */
async function fetchFirefoxDownloadStats() {
  console.log('ℹ️  Firefox users data already in plugin data\n');
  return new Map(); // Return empty - data already exists
}

/**
 * WordPress plugins already have activeInstalls data - just return empty map
 */
async function fetchWordPressDownloadStats() {
  console.log('ℹ️  WordPress active installs data already in plugin data\n');
  return new Map(); // Return empty - data already exists
}

/**
 * Home Assistant - no download data, use GitHub stars as proxy
 */
async function fetchHomeAssistantDownloadStats() {
  console.log('ℹ️  Home Assistant has no download data, using GitHub stars as proxy\n');
  return new Map(); // Return empty - will use stars from githubStats
}

/**
 * JetBrains plugins already have downloads - just return empty map
 */
async function fetchJetBrainsDownloadStats() {
  console.log('ℹ️  JetBrains downloads already in plugin data\n');
  return new Map(); // Return empty - data already exists
}

/**
 * Sublime Text - no download data available, use GitHub stars as proxy
 */
async function fetchSublimeDownloadStats() {
  console.log('ℹ️  Sublime Text has no download data, using GitHub stars as proxy\n');
  return new Map(); // Return empty - will use stars from githubStats
}

/**
 * Chrome extensions already have users data - just return empty map
 */
async function fetchChromeDownloadStats() {
  console.log('ℹ️  Chrome user counts already in plugin data\n');
  return new Map(); // Return empty - data already exists
}

/**
 * Opera extensions already have user counts - just return empty map
 */
async function fetchOperaDownloadStats() {
  console.log('ℹ️  Opera user counts already in plugin data\n');
  return new Map(); // Return empty - data already exists
}

/**
 * Merge download stats into plugin data
 * Handles different download field names per platform
 */
function mergeDownloadStats(plugins, downloadMap, platform) {
  return plugins.map(plugin => {
    // Check if download data is from external source (downloadMap)
    const stats = downloadMap.get(plugin.id);
    if (stats) {
      return {
        ...plugin,
        downloads: stats.downloads,
        downloadStatsUpdated: stats.updatedDate || new Date().toISOString()
      };
    }
    
    // Check if download data is already in plugin (VS Code, Minecraft, etc.)
    let downloads = plugin.downloads;
    
    // Platform-specific field mapping
    if (!downloads) {
      switch (platform) {
        case 'vscode':
          downloads = plugin.installs || 0;
          break;
        case 'minecraft':
          downloads = plugin.downloadCount || 0;
          break;
        case 'firefox':
          // Firefox uses "users" for active user count
          downloads = plugin.users || plugin.weeklyDownloads || plugin.averageDailyUsers || 0;
          break;
        case 'wordpress':
          // WordPress uses install ranges, handle separately
          downloads = plugin.activeInstalls || 0;
          break;
        case 'homeassistant':
          // Home Assistant doesn't track downloads, use GitHub stars as proxy
          downloads = plugin.githubStats?.stars || 0;
          break;
        case 'jetbrains':
          // JetBrains already has downloads field
          downloads = plugin.downloads || 0;
          break;
        case 'sublime':
          // Sublime has unique_installs from Package Control API
          downloads = plugin.downloads || plugin.githubStats?.stars || 0;
          break;
        default:
          downloads = 0;
      }
    }
    
    if (downloads > 0) {
      return {
        ...plugin,
        downloads,
        downloadStatsUpdated: plugin.downloadStatsUpdated || new Date().toISOString()
      };
    }
    
    return plugin;
  });
}

/**
 * Get top N plugins by downloads
 */
function getTopPluginsByDownloads(plugins, n = 100) {
  return plugins
    .filter(p => p.downloads && p.downloads > 0)
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, n);
}

/**
 * Process a platform
 */
async function processPlatform(platform, fetchStatsFn) {
  const platformDir = path.join(DATA_DIR, platform);
  const pluginsFile = path.join(platformDir, 'plugins.json');
  const top100File = path.join(platformDir, 'top100.json');
  const metadataFile = path.join(platformDir, 'metadata.json');
  
  if (!fs.existsSync(pluginsFile)) {
    console.log(`⚠️  ${platform}/plugins.json not found. Run fetch-${platform}-plugins.js first.\n`);
    return null;
  }
  
  // Load existing plugins
  const pluginData = JSON.parse(fs.readFileSync(pluginsFile, 'utf8'));
  const plugins = pluginData.plugins || [];
  
  console.log(`📦 Processing ${plugins.length} ${platform} plugins...`);
  
  // Fetch download stats
  const downloadMap = await fetchStatsFn();
  
  // Merge download stats (pass platform name for field mapping)
  const pluginsWithDownloads = mergeDownloadStats(plugins, downloadMap, platform);
  
  // Get top 100
  const top100 = getTopPluginsByDownloads(pluginsWithDownloads, 100);
  
  // Mark top 100 plugins
  const pluginsWithTop100Flag = pluginsWithDownloads.map(plugin => {
    const isTop100 = top100.some(tp => tp.id === plugin.id);
    return {
      ...plugin,
      isTop100
    };
  });
  
  // Save updated plugins file
  fs.writeFileSync(pluginsFile, JSON.stringify({ plugins: pluginsWithTop100Flag }, null, 2));
  
  // Save top 100 separately for easy access
  fs.writeFileSync(top100File, JSON.stringify({ 
    platform,
    generatedAt: new Date().toISOString(),
    totalPlugins: plugins.length,
    top100: top100.map(p => ({
      id: p.id,
      name: p.name,
      author: p.author,
      description: p.description,
      repo: p.repo,
      downloads: p.downloads,
      stars: p.githubStats?.stars || 0,
      lastUpdated: p.githubStats?.lastUpdated || p.lastUpdated,
      isTop100: true
    }))
  }, null, 2));
  
  // Update metadata
  if (fs.existsSync(metadataFile)) {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    metadata.top100Count = top100.length;
    metadata.pluginsWithDownloads = pluginsWithDownloads.filter(p => p.downloads > 0).length;
    metadata.totalDownloads = pluginsWithDownloads.reduce((sum, p) => sum + (p.downloads || 0), 0);
    metadata.lastDownloadStatsUpdate = new Date().toISOString();
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  }
  
  console.log(`✅ ${platform.toUpperCase()} Summary:`);
  console.log(`   - Total plugins: ${plugins.length}`);
  console.log(`   - Plugins with downloads: ${pluginsWithDownloads.filter(p => p.downloads > 0).length}`);
  console.log(`   - Top 100 identified`);
  console.log(`   - Total downloads: ${pluginsWithDownloads.reduce((sum, p) => sum + (p.downloads || 0), 0).toLocaleString()}`);
  console.log(`   - Top plugin: ${top100[0]?.name} (${top100[0]?.downloads?.toLocaleString()} downloads)\n`);
  
  return {
    platform,
    total: plugins.length,
    withDownloads: pluginsWithDownloads.filter(p => p.downloads > 0).length,
    top100: top100.length,
    totalDownloads: pluginsWithDownloads.reduce((sum, p) => sum + (p.downloads || 0), 0)
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting download stats fetch for all platforms...\n');
  console.log('═'.repeat(60));
  console.log('\n');

  const results = [];

  try {
    // Process Obsidian
    console.log('📱 OBSIDIAN\n');
    const obsidianResult = await processPlatform('obsidian', fetchObsidianDownloadStats);
    if (obsidianResult) results.push(obsidianResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process VS Code (already has install data)
    console.log('💻 VS CODE\n');
    const vscodeResult = await processPlatform('vscode', fetchVSCodeDownloadStats);
    if (vscodeResult) results.push(vscodeResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process Minecraft (already has download data)
    console.log('🎮 MINECRAFT\n');
    const minecraftResult = await processPlatform('minecraft', fetchMinecraftDownloadStats);
    if (minecraftResult) results.push(minecraftResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process Firefox (already has users data)
    console.log('🦊 FIREFOX\n');
    const firefoxResult = await processPlatform('firefox', fetchFirefoxDownloadStats);
    if (firefoxResult) results.push(firefoxResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process WordPress (already has activeInstalls data)
    console.log('📝 WORDPRESS\n');
    const wordpressResult = await processPlatform('wordpress', fetchWordPressDownloadStats);
    if (wordpressResult) results.push(wordpressResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process Home Assistant (use GitHub stars as proxy)
    console.log('🏠 HOME ASSISTANT\n');
    const haResult = await processPlatform('homeassistant', fetchHomeAssistantDownloadStats);
    if (haResult) results.push(haResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process JetBrains (already has download data)
    console.log('🧠 JETBRAINS\n');
    const jetbrainsResult = await processPlatform('jetbrains', fetchJetBrainsDownloadStats);
    if (jetbrainsResult) results.push(jetbrainsResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process Sublime Text (use GitHub stars as proxy)
    console.log('📝 SUBLIME TEXT\n');
    const sublimeResult = await processPlatform('sublime', fetchSublimeDownloadStats);
    if (sublimeResult) results.push(sublimeResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process Chrome (already has user data)
    console.log('🌐 CHROME\n');
    const chromeResult = await processPlatform('chrome', fetchChromeDownloadStats);
    if (chromeResult) results.push(chromeResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Process Opera (already has user count data)
    console.log('🌐 OPERA\n');
    const operaResult = await processPlatform('opera', fetchOperaDownloadStats);
    if (operaResult) results.push(operaResult);
    console.log('═'.repeat(60));
    console.log('\n');

    // Generate summary report
    console.log('📊 OVERALL SUMMARY\n');
    const summaryFile = path.join(DATA_DIR, 'top100-summary.json');
    const summary = {
      generatedAt: new Date().toISOString(),
      platforms: results,
      totalPluginsAnalyzed: results.reduce((sum, r) => sum + r.total, 0),
      totalTop100Plugins: results.reduce((sum, r) => sum + r.top100, 0),
      totalDownloads: results.reduce((sum, r) => sum + r.totalDownloads, 0)
    };
    
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    
    console.log('Platform Summary:');
    results.forEach(r => {
      console.log(`   ${r.platform.padEnd(15)} - ${r.total} plugins, ${r.top100} top 100, ${r.totalDownloads.toLocaleString()} downloads`);
    });
    console.log(`\n   Total: ${summary.totalPluginsAnalyzed} plugins analyzed`);
    console.log(`   Total Downloads: ${summary.totalDownloads.toLocaleString()}\n`);
    
    console.log('✅ Download stats fetch completed successfully!');
    console.log(`\n📄 Files created:`);
    console.log(`   - data/top100-summary.json`);
    results.forEach(r => {
      console.log(`   - data/${r.platform}/top100.json`);
      console.log(`   - data/${r.platform}/plugins.json (updated with downloads & isTop100 flag)`);
    });

  } catch (error) {
    console.error('\n❌ Error fetching download stats:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();

export { 
  fetchObsidianDownloadStats, 
  fetchVSCodeDownloadStats,
  fetchMinecraftDownloadStats,
  fetchFirefoxDownloadStats,
  fetchWordPressDownloadStats,
  fetchHomeAssistantDownloadStats,
  fetchJetBrainsDownloadStats,
  fetchSublimeDownloadStats,
  processPlatform 
};

