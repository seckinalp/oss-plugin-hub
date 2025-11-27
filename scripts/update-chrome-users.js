import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const CHROME_DIR = path.join(DATA_DIR, 'chrome');
const PLUGINS_FILE = path.join(CHROME_DIR, 'plugins.json');

/**
 * Fetch from URL
 */
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject).end();
  });
}

/**
 * Parse user count from Chrome Web Store page HTML
 * The page contains a meta tag or JSON-LD with user count
 */
function parseUserCountFromHTML(html) {
  try {
    // Try to find user count in the HTML
    // Format: "30,000+ users" or "2,000,000+ users"
    const userMatch = html.match(/([0-9,]+)\+ users/i);
    if (userMatch) {
      const userStr = userMatch[1].replace(/,/g, '');
      return parseInt(userStr, 10);
    }
    
    // Try alternative format
    const altMatch = html.match(/"userCount":\s*"([0-9,]+)"/);
    if (altMatch) {
      return parseInt(altMatch[1].replace(/,/g, ''), 10);
    }
    
    // Try finding in ntp-contents JSON
    const jsonMatch = html.match(/"users":\s*"([0-9,]+)\+?"/);
    if (jsonMatch) {
      return parseInt(jsonMatch[1].replace(/,/g, ''), 10);
    }
    
    return 0;
  } catch (error) {
    console.error(`Error parsing user count: ${error.message}`);
    return 0;
  }
}

/**
 * Fetch user count for a Chrome extension
 */
async function fetchExtensionUsers(extensionId) {
  try {
    const url = `https://chrome.google.com/webstore/detail/${extensionId}`;
    const html = await fetchURL(url);
    const users = parseUserCountFromHTML(html);
    return users;
  } catch (error) {
    console.error(`  ⚠️  Error fetching ${extensionId}: ${error.message}`);
    return 0;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Fetching Chrome extension user counts...\n');
  
  try {
    // Load existing plugins
    if (!fs.existsSync(PLUGINS_FILE)) {
      console.error('❌ plugins.json not found. Run fetch-chrome first.');
      process.exit(1);
    }
    
    const pluginData = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8'));
    const plugins = pluginData.plugins || [];
    
    console.log(`📦 Loaded ${plugins.length} Chrome extensions\n`);
    console.log('📥 Fetching user counts from Chrome Web Store...');
    console.log('   (This may take a few minutes due to rate limiting)\n');
    
    const updatedPlugins = [];
    let successCount = 0;
    
    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      console.log(`   [${i + 1}/${plugins.length}] ${plugin.name}...`);
      
      const users = await fetchExtensionUsers(plugin.extensionId);
      
      updatedPlugins.push({
        ...plugin,
        users,
        downloads: users, // Use users as downloads for consistency
        downloadStatsUpdated: new Date().toISOString()
      });
      
      if (users > 0) {
        successCount++;
        console.log(`      ✓ ${(users / 1000000).toFixed(2)}M users`);
      } else {
        console.log(`      ⚠️  No data`);
      }
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }
    
    console.log(`\n✓ Successfully fetched user counts for ${successCount}/${plugins.length} extensions\n`);
    
    // Save updated data
    fs.writeFileSync(PLUGINS_FILE, JSON.stringify({ plugins: updatedPlugins }, null, 2));
    
    // Show top 10
    const top10 = updatedPlugins
      .filter(p => p.users > 0)
      .sort((a, b) => b.users - a.users)
      .slice(0, 10);
    
    if (top10.length > 0) {
      console.log('📊 Top 10 Chrome extensions by users:');
      top10.forEach((ext, i) => {
        const users = ext.users >= 1000000 
          ? (ext.users / 1000000).toFixed(2) + 'M'
          : (ext.users / 1000).toFixed(1) + 'K';
        console.log(`   ${i + 1}. ${ext.name} - ${users} users`);
      });
    }
    
    const withUsers = updatedPlugins.filter(p => p.users > 0).length;
    const totalUsers = updatedPlugins.reduce((sum, p) => sum + (p.users || 0), 0);
    
    console.log(`\n✅ Summary:`);
    console.log(`   - Total extensions: ${updatedPlugins.length}`);
    console.log(`   - Extensions with user data: ${withUsers}`);
    console.log(`   - Total users: ${(totalUsers / 1000000).toFixed(2)}M`);
    console.log(`\n✅ Chrome user counts updated successfully!`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

