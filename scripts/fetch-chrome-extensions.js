import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DATA_DIR = path.join(__dirname, '../data');
const CHROME_DIR = path.join(DATA_DIR, 'chrome');
const PLUGINS_FILE = path.join(CHROME_DIR, 'plugins.json');
const METADATA_FILE = path.join(CHROME_DIR, 'metadata.json');

// Chrome Web Store doesn't have an official public API for listing extensions
// We'll need to use alternative approaches:
// 1. Chrome Web Store search (limited)
// 2. Third-party aggregators
// 3. Manual curated lists + scraping
// 4. Extension discovery services

// For now, we'll use a combination of:
// - Popular extension lists from various sources
// - Chrome Web Store detail pages for individual extensions

const GITHUB_ONLY = process.env.CHROME_GITHUB_ONLY !== 'false'; // Default: only extensions with GitHub repos

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CHROME_DIR)) {
  fs.mkdirSync(CHROME_DIR, { recursive: true });
}

/**
 * Fetch from Chrome Extension Stats API (if available)
 * Note: Chrome Web Store doesn't have an official public API
 * We'll use chrome-stats.com or similar services
 */
function fetchChromeStats(url) {
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
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    }).on('error', reject).end();
  });
}

/**
 * Known popular Chrome extensions with GitHub repos
 * This is a starter list - we'll expand this with automated discovery
 */
const KNOWN_EXTENSIONS = [
  // Ad Blockers
  { id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm', name: 'uBlock Origin', repo: 'gorhill/uBlock' },
  { id: 'gighmmpiobklfepjocnamgkkbiglidom', name: 'AdBlock', repo: 'betafish-inc/adblock-releases' },
  { id: 'cfhdojbkjhnklbpkdaibdccddilifddb', name: 'Adblock Plus', repo: 'adblockplus/adblockpluschrome' },
  
  // Privacy & Security
  { id: 'gcbommkclmclpchllfjekcdonpmejbdp', name: 'HTTPS Everywhere', repo: 'EFForg/https-everywhere' },
  { id: 'fihnjjcciajhdojfnbdddfaoknhalnja', name: 'I don\'t care about cookies', repo: 'OhMyGuus/I-Dont-Care-About-Cookies' },
  { id: 'nngceckbapebfimnlniiiahkandclblb', name: 'Bitwarden', repo: 'bitwarden/clients' },
  { id: 'hdokiejnpimakedhajhdlcegeplioahd', name: 'LastPass', repo: null },
  { id: 'fooolghllnmhmmndgjiamiiodkpenpbb', name: 'NordPass', repo: null },
  
  // Productivity
  { id: 'mdjildafknihdffpkfmmpnpoiajfjnjd', name: 'Consent-O-Matic', repo: 'cavi-au/Consent-O-Matic' },
  { id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh', name: 'Dark Reader', repo: 'darkreader/darkreader' },
  { id: 'dbepggeogbaibhgnhhndojpepiihcmeb', name: 'Vimium', repo: 'philc/vimium' },
  { id: 'hdannnflhlmdablckfkjpleikpphncik', name: 'Vimium C', repo: 'gdh1995/vimium-c' },
  { id: 'lckanjgmijmafbedllaakclkaicjfmnk', name: 'ClearURLs', repo: 'ClearURLs/Addon' },
  
  // Developer Tools
  { id: 'fmkadmapgofadopljbjfkapdkoienihi', name: 'React Developer Tools', repo: 'facebook/react' },
  { id: 'nhdogjmejiglipccpnnnanhbledajbpd', name: 'Vue.js devtools', repo: 'vuejs/devtools' },
  { id: 'lmhkpmbekcpmknklioeibfkpmmfibljd', name: 'Redux DevTools', repo: 'reduxjs/redux-devtools' },
  { id: 'bfbameneiokkgbdmiekhjnmfkcnldhhm', name: 'Web Developer', repo: 'chrispederick/web-developer' },
  { id: 'gppongmhjkpfnbhagpmjfkannfbllamg', name: 'Wappalyzer', repo: 'wappalyzer/wappalyzer' },
  
  // Social & Media
  { id: 'mnjggcdmjocbbbhaepdhchncahnbgone', name: 'SponsorBlock', repo: 'ajayyy/SponsorBlock' },
  { id: 'gebbhagfogifgggkldgodflihgfeippi', name: 'Return YouTube Dislike', repo: 'Anarios/return-youtube-dislike' },
  { id: 'gbkdmjocmhdhehbhbamgijhkbebhnnml', name: 'Enhancer for YouTube', repo: null },
  
  // Misc Popular
  { id: 'bmnlcjabgnpnenekpadlanbbkooimhnj', name: 'Honey', repo: null },
  { id: 'oldceeleldhonbafppcapldpdifcinji', name: 'LanguageTool', repo: 'languagetool-org/languagetool' },
  { id: 'aapbdbdomjkkjkaonfhkkikfgjllcleb', name: 'Google Translate', repo: null },
  { id: 'ghbmnnjooekpmoecnnnilnnbdlolhkhi', name: 'Google Docs Offline', repo: null },
  { id: 'dhdgffkkebhmkfjojejmpbldmpobfkfo', name: 'Tampermonkey', repo: 'Tampermonkey/tampermonkey' },
  { id: 'gcalenpjmijncebpfijmoaglllgpjagf', name: 'Tab Wrangler', repo: 'tabwrangler/tabwrangler' },
  { id: 'mmeijimgabbpbgpdklnllpncmdofkcpn', name: 'SingleFile', repo: 'gildas-lormeau/SingleFile' },
  
  // More open source extensions
  { id: 'clngdbkpkpeebahjckkjfobafhncgmne', name: 'Stylus', repo: 'openstyles/stylus' },
  { id: 'hlepfoohegkhhmjieoechaddaejaokhf', name: 'Refined GitHub', repo: 'refined-github/refined-github' },
  { id: 'aleakchihdccplidncghkekgioiakgal', name: 'h264ify', repo: 'erkserkserks/h264ify' },
  { id: 'ennpfpdlaclocpomkiablnmbppdnlhoh', name: 'Rust Search Extension', repo: 'huhu/rust-search-extension' },
  { id: 'fihnjjcciajhdojfnbdddfaoknhalnja', name: 'I still don\'t care about cookies', repo: 'OhMyGuus/I-Still-Dont-Care-About-Cookies' },
];

/**
 * Parse Chrome extension to our plugin format
 */
function parseChromeExtension(ext, statsData) {
  return {
    id: `chrome-${ext.id}`,
    name: ext.name,
    author: statsData?.author || 'Unknown',
    description: statsData?.description || ext.name,
    repo: ext.repo,
    platform: 'chrome',
    extensionId: ext.id,
    storeUrl: `https://chrome.google.com/webstore/detail/${ext.id}`,
    users: statsData?.users || 0,
    rating: statsData?.rating || 0,
    ratingCount: statsData?.ratingCount || 0,
    version: statsData?.version || '1.0.0',
    lastUpdated: statsData?.lastUpdated || new Date().toISOString(),
    categories: statsData?.categories || [],
    homepage: ext.repo ? `https://github.com/${ext.repo}` : null
  };
}

/**
 * Fetch extension details from Chrome Web Store
 * Note: This requires web scraping as there's no official API
 * For now, we'll use placeholder data and focus on extensions we know about
 */
async function fetchExtensionStats(extensionId) {
  // In a real implementation, this would scrape the Chrome Web Store page
  // or use a third-party API service
  // For now, return placeholder that we'll enhance later
  return {
    users: 0, // Will be updated when we find a data source
    rating: 0,
    ratingCount: 0,
    description: '',
    author: 'Unknown',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    categories: []
  };
}

/**
 * Save plugins and metadata
 */
function savePluginsAndMetadata(chromePlugins) {
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
  const mergedPlugins = chromePlugins.map(plugin => {
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
    platform: 'chrome',
    totalCount: mergedPlugins.length,
    lastUpdated: new Date().toISOString(),
    lastStatsUpdate: pluginsWithStats.length > 0 ? new Date().toISOString() : null,
    pluginsWithGitHubStats: pluginsWithStats.length,
    pluginsWithGitHubRepos: pluginsWithRepos.length,
    stats: {
      totalUsers: mergedPlugins.reduce((sum, p) => sum + (p.users || 0), 0),
      totalStars: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.stars || 0), 0),
      totalForks: pluginsWithStats.reduce((sum, p) => sum + (p.githubStats?.forks || 0), 0),
      averageRating: mergedPlugins.filter(p => p.rating > 0).reduce((sum, p) => sum + p.rating, 0) / mergedPlugins.filter(p => p.rating > 0).length || 0
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
  console.log('🚀 Starting Chrome Web Store extension fetch...\n');
  console.log(`📝 Configuration:`);
  console.log(`   - GitHub only: ${GITHUB_ONLY ? 'YES' : 'NO'}`);
  console.log(`   - Set CHROME_GITHUB_ONLY=false to include all extensions\n`);
  
  console.log('⚠️  Note: Chrome Web Store doesn\'t have an official public API');
  console.log('   Starting with curated list of popular open-source extensions\n');
  
  try {
    // Start with known extensions
    console.log(`📥 Processing ${KNOWN_EXTENSIONS.length} known Chrome extensions...`);
    
    const chromePlugins = [];
    
    for (const ext of KNOWN_EXTENSIONS) {
      // Skip if GitHub-only mode and no repo
      if (GITHUB_ONLY && !ext.repo) {
        continue;
      }
      
      // Fetch extension stats (placeholder for now)
      const stats = await fetchExtensionStats(ext.id);
      
      // Parse to our format
      const plugin = parseChromeExtension(ext, stats);
      chromePlugins.push(plugin);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✓ Processed ${chromePlugins.length} Chrome extensions\n`);
    
    if (GITHUB_ONLY) {
      const withRepos = chromePlugins.filter(p => p.repo);
      console.log(`   - With GitHub repos: ${withRepos.length}`);
      console.log(`   - Without GitHub repos: ${chromePlugins.length - withRepos.length} (filtered out)\n`);
    }
    
    // Show sample
    console.log('📊 Sample extensions:');
    chromePlugins.slice(0, 10).forEach((ext, i) => {
      console.log(`   ${i + 1}. ${ext.name} by ${ext.author}`);
    });
    console.log('');
    
    // Save plugins and metadata
    console.log('💾 Saving extensions and metadata...');
    const result = savePluginsAndMetadata(chromePlugins);
    
    console.log(`✓ Saved to ${CHROME_DIR}/`);
    console.log(`   - plugins.json (${result.plugins.length} extensions)`);
    console.log(`   - metadata.json`);
    console.log(`\n📊 Chrome Web Store Stats:`);
    console.log(`   - Total: ${result.metadata.totalCount}`);
    console.log(`   - With GitHub repos: ${result.metadata.pluginsWithGitHubRepos}`);
    console.log(`   - With GitHub stats: ${result.metadata.pluginsWithGitHubStats}`);
    console.log('\n✅ Chrome Web Store extension fetch completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run "npm run update-stats:chrome" to fetch GitHub stats');
    console.log('   2. Enhance this script to fetch more extensions (web scraping/API)');
    console.log('   3. Add user count data from Chrome Web Store');
    
  } catch (error) {
    console.error('\n❌ Error fetching Chrome extensions:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();

