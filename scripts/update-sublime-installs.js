import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const SUBLIME_DIR = path.join(DATA_DIR, 'sublime');
const PLUGINS_FILE = path.join(SUBLIME_DIR, 'plugins.json');

/**
 * Fetch popular packages from Package Control
 */
function fetchPopularPackages(page = 1) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'packagecontrol.io',
      path: `/browse/popular.json?page=${page}`,
      method: 'GET',
      headers: {
        'User-Agent': 'OSS-Plugin-Hub/1.0'
      }
    };

    https.request(options, (res) => {
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
  console.log('🚀 Fetching Sublime Text install counts from Package Control...\n');
  
  try {
    // Load existing plugins
    if (!fs.existsSync(PLUGINS_FILE)) {
      console.error('❌ plugins.json not found. Run fetch-sublime-plugins.js first.');
      process.exit(1);
    }
    
    const pluginData = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
    const plugins = pluginData.plugins || [];
    
    console.log(`📦 Loaded ${plugins.length} Sublime Text packages\n`);
    
    // Fetch popular packages (need more pages to ensure we get 100 with GitHub repos)
    console.log('📥 Fetching install counts from Package Control...');
    const installData = new Map();
    const packageDetails = new Map(); // Store full package info
    
    for (let page = 1; page <= 10; page++) {
      console.log(`   - Fetching page ${page}...`);
      const data = await fetchPopularPackages(page);
      
      if (data.packages) {
        data.packages.forEach(pkg => {
          installData.set(pkg.name.toLowerCase(), pkg.unique_installs || 0);
          packageDetails.set(pkg.name.toLowerCase(), pkg);
        });
      }
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✓ Fetched install counts for ${installData.size} packages\n`);
    
    // Update plugins with install data
    console.log('🔄 Merging install data...');
    let updatedCount = 0;
    
    const updatedPlugins = plugins.map(plugin => {
      // Try to match by package name or plugin name
      const installs = installData.get(plugin.name.toLowerCase()) || 
                       installData.get(plugin.packageName?.toLowerCase()) || 
                       plugin.downloads ||
                       0;
      
      if (installs > 0 && installs !== plugin.downloads) {
        updatedCount++;
      }
      
      return {
        ...plugin,
        downloads: installs,
        downloadStatsUpdated: new Date().toISOString()
      };
    });
    
    console.log(`✓ Updated ${updatedCount} packages with install data\n`);
    
    // Save updated data
    fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: updatedPlugins }, null, 2));
    
    // Show top 10
    const top10 = updatedPlugins
      .filter(p => p.downloads > 0)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10);
    
    console.log('📊 Top 10 Sublime Text packages by installs:');
    top10.forEach((pkg, i) => {
      const installs = (pkg.downloads / 1000000).toFixed(2) + 'M';
      console.log(`   ${i + 1}. ${pkg.name} - ${installs} installs`);
    });
    
    const withInstalls = updatedPlugins.filter(p => p.downloads > 0).length;
    const totalInstalls = updatedPlugins.reduce((sum, p) => sum + (p.downloads || 0), 0);
    
    console.log(`\n✅ Summary:`);
    console.log(`   - Total packages: ${updatedPlugins.length}`);
    console.log(`   - Packages with install data: ${withInstalls}`);
    console.log(`   - Total installs: ${(totalInstalls / 1000000).toFixed(2)}M`);
    console.log(`\n✅ Sublime Text install counts updated successfully!`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

