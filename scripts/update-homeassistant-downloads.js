import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const HA_DIR = path.join(DATA_DIR, 'homeassistant');
const PLUGINS_FILE = path.join(HA_DIR, 'plugins.json');

// HACS data endpoints for different categories
const HACS_DATA_URLS = [
  'https://data-v2.hacs.xyz/integration/data.json',
  'https://data-v2.hacs.xyz/plugin/data.json',
  'https://data-v2.hacs.xyz/theme/data.json',
  'https://data-v2.hacs.xyz/appdaemon/data.json',
  'https://data-v2.hacs.xyz/python_script/data.json',
  'https://data-v2.hacs.xyz/template/data.json',
  'https://data-v2.hacs.xyz/netdaemon/data.json'
];

/**
 * Fetch JSON from URL
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject).end();
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Fetching Home Assistant download counts from HACS...\n');
  
  try {
    // Load existing plugins
    if (!fs.existsSync(PLUGINS_FILE)) {
      console.error('❌ plugins.json not found. Run fetch-homeassistant-components.js first.');
      process.exit(1);
    }
    
    const pluginData = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
    const plugins = pluginData.plugins || [];
    
    console.log(`📦 Loaded ${plugins.length} Home Assistant components\n`);
    
    // Fetch download data from all HACS categories
    console.log('📥 Fetching download counts from HACS data API...');
    const downloadData = new Map();
    
    for (const url of HACS_DATA_URLS) {
      const category = url.split('/')[3]; // Extract category from URL
      console.log(`   - Fetching ${category}...`);
      
      try {
        const data = await fetchJSON(url);
        
        // Parse the data - it's an object with repository IDs as keys
        Object.entries(data).forEach(([repoId, repoData]) => {
          if (repoData.full_name) {
            const repoKey = repoData.full_name.toLowerCase();
            const downloads = repoData.downloads || 0;
            downloadData.set(repoKey, downloads);
            // Also store by domain for matching
            if (repoData.domain) {
              downloadData.set(`domain:${repoData.domain}`, downloads);
            }
          }
        });
      } catch (error) {
        console.log(`     ⚠️  Error fetching ${category}: ${error.message}`);
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✓ Fetched download data for ${downloadData.size} components\n`);
    
    // Update plugins with download data
    console.log('🔄 Merging download data and cleaning repository names...');
    let updatedCount = 0;
    let cleanedCount = 0;
    
    const updatedPlugins = plugins.map(plugin => {
      // Clean up malformed repo name
      let cleanRepo = plugin.repo;
      if (cleanRepo) {
        // Remove extra quotes and commas that got included during parsing
        cleanRepo = cleanRepo
          .replace(/^\s*"*/g, '')  // Remove leading spaces and quotes
          .replace(/"*,*\s*$/g, '') // Remove trailing quotes, commas, spaces
          .replace(/\\"/g, '"')     // Unescape quotes
          .trim();
        
        if (cleanRepo !== plugin.repo) {
          cleanedCount++;
        }
      }
      
      // Try to match by cleaned repo name or by domain
      const repoKey = cleanRepo?.toLowerCase();
      let downloads = plugin.downloads || 0;
      
      // Try matching by repo name first
      if (repoKey && downloadData.has(repoKey)) {
        downloads = downloadData.get(repoKey);
      }
      
      if (downloads > 0 && downloads !== plugin.downloads) {
        updatedCount++;
      }
      
      return {
        ...plugin,
        repo: cleanRepo, // Use cleaned repo name
        downloads,
        downloadStatsUpdated: new Date().toISOString()
      };
    });
    
    console.log(`✓ Cleaned ${cleanedCount} malformed repository names`);
    console.log(`✓ Updated ${updatedCount} components with download data\n`);
    
    console.log(`✓ Updated ${updatedCount} components with download data\n`);
    
    // Save updated data
    fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: updatedPlugins }, null, 2));
    
    // Show top 10
    const top10 = updatedPlugins
      .filter(p => p.downloads > 0)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10);
    
    console.log('📊 Top 10 Home Assistant components by downloads:');
    top10.forEach((comp, i) => {
      const downloads = (comp.downloads / 1000).toFixed(1) + 'K';
      console.log(`   ${i + 1}. ${comp.name} - ${downloads} downloads`);
    });
    
    const withDownloads = updatedPlugins.filter(p => p.downloads > 0).length;
    const totalDownloads = updatedPlugins.reduce((sum, p) => sum + (p.downloads || 0), 0);
    
    console.log(`\n✅ Summary:`);
    console.log(`   - Total components: ${updatedPlugins.length}`);
    console.log(`   - Components with download data: ${withDownloads}`);
    console.log(`   - Total downloads: ${(totalDownloads / 1000).toFixed(1)}K`);
    console.log(`\n✅ Home Assistant download counts updated successfully!`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

