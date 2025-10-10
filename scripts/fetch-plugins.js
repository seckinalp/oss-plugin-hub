const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const OBSIDIAN_PLUGINS_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json';
const DATA_DIR = path.join(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'plugins.json');
const PREVIOUS_FILE = path.join(DATA_DIR, 'plugins-previous.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
 * Save current plugins data as previous (for comparison)
 */
function savePreviousData() {
  if (fs.existsSync(OUTPUT_FILE)) {
    const current = fs.readFileSync(OUTPUT_FILE, 'utf8');
    fs.writeFileSync(PREVIOUS_FILE, current);
    console.log('✓ Saved previous plugin data for comparison');
  }
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
 * Main function
 */
async function main() {
  console.log('🚀 Starting plugin data fetch...\n');

  try {
    // Save current data as previous (if exists)
    savePreviousData();

    // Fetch plugin data
    console.log('📥 Fetching plugin data from Obsidian repository...');
    const plugins = await fetchJSON(OBSIDIAN_PLUGINS_URL);
    console.log(`✓ Fetched ${plugins.length} plugins\n`);

    // Load previous data for comparison
    let previousPlugins = [];
    if (fs.existsSync(PREVIOUS_FILE)) {
      const previousData = JSON.parse(fs.readFileSync(PREVIOUS_FILE, 'utf8'));
      previousPlugins = previousData.plugins || [];
    }

    // Detect new plugins
    const newPlugins = detectNewPlugins(plugins, previousPlugins);
    if (newPlugins.length > 0) {
      console.log(`🆕 Found ${newPlugins.length} new plugin(s):`);
      newPlugins.forEach(plugin => {
        console.log(`   - ${plugin.name} by ${plugin.author}`);
      });
      console.log('');
    } else {
      console.log('ℹ️  No new plugins detected\n');
    }

    // Prepare output data
    const outputData = {
      plugins: plugins,
      lastUpdated: new Date().toISOString(),
      totalCount: plugins.length,
      newPlugins: newPlugins.map(p => p.id),
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
    console.log(`✓ Saved plugin data to ${OUTPUT_FILE}`);
    console.log(`✓ Last updated: ${outputData.lastUpdated}`);
    console.log('\n✅ Plugin data fetch completed successfully!');

  } catch (error) {
    console.error('\n❌ Error fetching plugin data:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

