const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const OBSIDIAN_PLUGINS_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json';
const DATA_DIR = path.join(__dirname, '../data');
const OBSIDIAN_DIR = path.join(DATA_DIR, 'obsidian');
const PLUGINS_FILE = path.join(OBSIDIAN_DIR, 'plugins.json');
const METADATA_FILE = path.join(OBSIDIAN_DIR, 'metadata.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(OBSIDIAN_DIR)) {
  fs.mkdirSync(OBSIDIAN_DIR, { recursive: true });
}

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
 * Detect new plugins
 */
function detectNewPlugins(currentPlugins, previousPlugins) {
  if (!previousPlugins || previousPlugins.length === 0) {
    return [];
  }

  const previousIds = new Set(previousPlugins.map(p => p.id));
  const newPlugins = currentPlugins.filter(p => !previousIds.has(p.id));
  
  return newPlugins;
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(obsidianPlugins) {
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
  const mergedPlugins = obsidianPlugins.map(plugin => {
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
  const metadata = {
    platform: 'obsidian',
    totalCount: mergedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    stats: {
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      totalWatchers: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.watchers || 0), 0),
      openIssues: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.openIssues || 0), 0),
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
  console.log('🚀 Starting Obsidian plugin data fetch...\n');

  try {
    // Fetch plugin data
    console.log('📥 Fetching plugin data from Obsidian repository...');
    const obsidianPlugins = await fetchJSON(OBSIDIAN_PLUGINS_URL);
    console.log(`✓ Fetched ${obsidianPlugins.length} Obsidian plugins\n`);
    
    // Add platform field to all plugins
    const plugins = obsidianPlugins.map(plugin => ({
      ...plugin,
      platform: 'obsidian'
    }));

    // Load previous data for comparison
    let previousPlugins = [];
    if (fs.existsSync(PLUGINS_FILE)) {
      const existingData = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
      previousPlugins = existingData.plugins || [];
    }

    // Detect new plugins
    const newPlugins = detectNewPlugins(plugins, previousPlugins);
    if (newPlugins.length > 0) {
      console.log(`🆕 Found ${newPlugins.length} new Obsidian plugin(s):`);
      newPlugins.forEach(plugin => {
        console.log(`   - ${plugin.name} by ${plugin.author}`);
      });
      console.log('');
    } else {
      console.log('ℹ️  No new Obsidian plugins detected\n');
    }

    // Save plugins and metadata
    console.log('💾 Saving plugins and metadata...');
    const result = savePluginsAndMetadata(plugins);

    console.log(`✓ Saved to ${OBSIDIAN_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} plugins)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Obsidian Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log(`   - Total stars: ${result.metadata.stats.totalStars.toLocaleString()}`);
    console.log('\n✅ Obsidian plugin fetch completed successfully!');

  } catch (error) {
    console.error('\n❌ Error fetching plugin data:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

